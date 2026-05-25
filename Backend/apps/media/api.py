from rest_framework import viewsets, permissions, parsers
from rest_framework.exceptions import ValidationError

from .models import MediaFile
from .serializers import MediaFileSerializer

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_MIME_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"}
)


class IsEditorOrAdmin(permissions.BasePermission):
    """Allows access only to staff users or members of the 'editors' group."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_staff or request.user.groups.filter(name="editors").exists()


class MediaFileViewSet(viewsets.ModelViewSet):
    serializer_class = MediaFileSerializer
    queryset = MediaFile.objects.select_related("uploaded_by").all()
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]
    http_method_names = ["get", "post", "delete", "head", "options"]

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
            if ct not in _ALLOWED_MIME_TYPES:
                raise ValidationError(
                    {"image": "Formato não suportado. Use JPEG, PNG, WebP, GIF ou AVIF."}
                )
        serializer.save()
