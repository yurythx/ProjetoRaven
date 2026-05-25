from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions, parsers
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.profile import ProfileService
from ..serializers.user import UserProfileSerializer, UserProfileUpdateSerializer
from ..permissions import IsNotBanned
from apps.common.utils import get_ip_and_ua


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def get(self, request):
        try:
            # Use serializer for base profile data to ensure consistency
            serializer = UserProfileSerializer(request.user)
            profile = serializer.data
            
            # Add extra fields with safe checks
            profile["is_active"] = bool(getattr(request.user, "is_active", False))
            profile["is_banned"] = bool(getattr(request.user, "is_banned", False))
            profile["is_verified"] = bool(getattr(request.user, "is_verified", False))
            profile["is_admin_verified"] = bool(getattr(request.user, "is_admin_verified", False))
            profile["is_admin"] = bool(getattr(request.user, "is_admin", False))
            profile["is_staff"] = bool(getattr(request.user, "is_staff", False))
            profile["is_superuser"] = bool(getattr(request.user, "is_superuser", False))
            profile["is_member"] = bool(getattr(request.user, "is_member", False))
            profile["is_blog_editor"] = bool(getattr(request.user, "is_blog_editor", False))
            profile["is_forum_moderator"] = bool(getattr(request.user, "is_forum_moderator", False))
            
            return Response(profile)
        except Exception as e:
            # Fallback to a minimal profile if something fails to avoid 500
            return Response({
                "id": str(request.user.id),
                "email": request.user.email,
                "username": request.user.username,
                "error": str(e)
            }, status=status.HTTP_200_OK)


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

    def put(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserProfileSerializer(user).data)


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def post(self, request):
        password = (request.data.get("password") or "").strip()
        if not password:
            return Response({"error": "Senha é obrigatória."}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(password):
            return Response({"error": "Senha incorreta."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        uid = str(user.id)
        # Anonymize PII
        user.email = f"deleted_{uid}@deleted.invalid"
        user.username = f"deleted_{uid}"
        user.display_name = "Conta Removida"
        user.is_active = False
        user.save(update_fields=["email", "username", "display_name", "is_active"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class ChangeUsernameView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def post(self, request):
        from django.contrib.auth import get_user_model as _get_user_model
        from apps.accounts.validators import CustomValidators

        User = _get_user_model()
        new_username = (request.data.get("username") or "").strip()
        if not new_username:
            return Response({"error": "Username é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_username = CustomValidators.validate_username(new_username)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username__iexact=new_username).exclude(pk=request.user.pk).exists():
            return Response({"error": "Este username já está em uso."}, status=status.HTTP_400_BAD_REQUEST)

        request.user.username = new_username
        request.user.save(update_fields=["username"])
        return Response(UserProfileSerializer(request.user).data)


class AvatarUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        avatar = request.FILES.get("avatar")
        if not avatar:
            return Response({"error": "Nenhum arquivo enviado."}, status=status.HTTP_400_BAD_REQUEST)

        if not avatar.content_type.startswith("image/"):
            return Response({"error": "Apenas imagens são permitidas."}, status=status.HTTP_400_BAD_REQUEST)

        if avatar.size > 5 * 1024 * 1024:
            return Response({"error": "Imagem muito grande. Máximo 5 MB."}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.avatar:
            try:
                request.user.avatar.delete(save=False)
            except Exception:
                pass

        request.user.avatar = avatar
        request.user.save(update_fields=["avatar"])
        return Response(UserProfileSerializer(request.user).data)

    def delete(self, request):
        if request.user.avatar:
            try:
                request.user.avatar.delete(save=False)
            except Exception:
                pass
            request.user.avatar = None
            request.user.save(update_fields=["avatar"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicProfileView(APIView):
    """Public read-only profile — no auth required."""
    permission_classes = []
    authentication_classes = []

    def get(self, request, username):
        from apps.forum.models import Topic, Reply
        from apps.blog.models import Post

        User = get_user_model()
        user = get_object_or_404(User, username=username, is_active=True)

        topics_qs = Topic.objects.filter(
            author=user,
            status__in=["open", "closed"],
        ).select_related("category").order_by("-created_at")

        recent_topics = [
            {
                "slug": t.slug,
                "title": t.title,
                "category_name": t.category.name,
                "category_slug": t.category.slug,
                "created_at": t.created_at,
                "reply_count": t.reply_count,
            }
            for t in topics_qs[:5]
        ]

        posts_qs = Post.objects.filter(
            author=user,
            status="published",
        ).order_by("-published_at")

        recent_posts = [
            {
                "slug": p.slug,
                "title": p.title,
                "published_at": p.published_at,
                "cover_image": request.build_absolute_uri(p.image.url) if p.image else None,
            }
            for p in posts_qs[:5]
        ]

        return Response({
            "username":      user.username,
            "display_name":  user.display_name or user.username,
            "date_joined":   user.date_joined,
            "is_verified":   bool(getattr(user, "is_verified", False)),
            "avatar":        request.build_absolute_uri(user.avatar.url) if getattr(user, "avatar", None) else None,
            "bio":           getattr(user, "bio", None) or None,
            "website":       getattr(user, "website", None) or None,
            "stats": {
                "forum_topics":  topics_qs.count(),
                "forum_replies": Reply.objects.filter(author=user).count(),
                "blog_posts":    posts_qs.count(),
            },
            "recent_topics": recent_topics,
            "recent_posts":  recent_posts,
        })
