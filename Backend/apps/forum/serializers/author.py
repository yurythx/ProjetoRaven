from rest_framework import serializers

class AuthorSerializer(serializers.Serializer):
    """Minimal author serializer for nested use."""
    id = serializers.UUIDField(read_only=True)
    username = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    def get_avatar_url(self, obj):
        if not getattr(obj, "avatar", None):
            return None
        from django.conf import settings
        from apps.common.utils import build_media_url
        relative = f"{settings.MEDIA_URL}{obj.avatar.name}"
        return build_media_url(relative, self.context.get("request"))
