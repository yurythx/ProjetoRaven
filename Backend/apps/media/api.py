from rest_framework import viewsets, permissions, parsers, filters
from rest_framework.exceptions import APIException, ValidationError

from .models import MediaFile
from .serializers import MediaFileSerializer

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_MIME_TYPES = frozenset(
    {
        "image/jpeg",
        "image/jpg",
        "image/pjpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
    }
)
_ALLOWED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")


class MediaInUse(APIException):
    status_code = 409
    default_detail = "Não é possível remover esta imagem porque ela está sendo usada."
    default_code = "media_in_use"

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail or self.default_detail, code=code or self.default_code)


class IsEditorOrAdmin(permissions.BasePermission):
    """Allows access to staff/superusers and blog editors.

    Keep the legacy `editors` group as a fallback while environments are
    standardized on `blog_editors`.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_staff
            or request.user.is_superuser
            or request.user.groups.filter(name__in=["blog_editors", "editors"]).exists()
        )


class MediaFileViewSet(viewsets.ModelViewSet):
    serializer_class = MediaFileSerializer
    queryset = MediaFile.objects.select_related("uploaded_by").all()
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]
    http_method_names = ["get", "post", "delete", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["alt_text", "original_filename"]
    ordering_fields = ["created_at", "original_filename"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsEditorOrAdmin()]

    def perform_create(self, serializer):
        img = self.request.FILES.get("image")
        if img:
            if img.size > _MAX_UPLOAD_BYTES:
                raise ValidationError(
                    {"image": f"Arquivo muito grande. Tamanho máximo: {_MAX_UPLOAD_BYTES // 1024 // 1024} MB."}
                )
            ct = getattr(img, "content_type", "")
            if ct in ("", "application/octet-stream"):
                name = (getattr(img, "name", "") or "").lower()
                if not name.endswith(_ALLOWED_EXTENSIONS):
                    raise ValidationError(
                        {"image": "Formato não suportado. Use JPEG, PNG, WebP, GIF ou AVIF."}
                    )
            elif ct not in _ALLOWED_MIME_TYPES:
                raise ValidationError(
                    {"image": "Formato não suportado. Use JPEG, PNG, WebP, GIF ou AVIF."}
                )
        serializer.save()

    def perform_destroy(self, instance):
        from django.conf import settings
        from apps.blog.models import Post
        from apps.accounts.models import User

        name = (instance.image.name or "").lstrip("/")
        if not name:
            instance.delete()
            return

        relative = f"{getattr(settings, 'MEDIA_URL', '/media/')}{name}"

        cover_posts = list(
            Post.objects.filter(image=name)
            .values("slug", "title")[:5]
        )
        content_posts = list(
            Post.objects.filter(content__icontains=relative)
            .values("slug", "title")[:5]
        )
        if not content_posts:
            content_posts = list(
                Post.objects.filter(content__icontains=name)
                .values("slug", "title")[:5]
            )
        avatar_users = list(
            User.objects.filter(avatar=name)
            .values_list("username", flat=True)[:5]
        )

        if cover_posts or content_posts or avatar_users:
            raise MediaInUse(
                detail={
                    "detail": "Não é possível remover esta imagem porque ela está sendo usada.",
                    "used_by": {
                        "cover_posts": cover_posts,
                        "content_posts": content_posts,
                        "avatars": avatar_users,
                    },
                }
            )
        instance.delete()
