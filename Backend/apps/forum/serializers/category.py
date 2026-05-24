from rest_framework import serializers
from ..models import ForumCategory

class ForumCategoryListSerializer(serializers.ModelSerializer):
    """Serializer for forum category list."""
    class Meta:
        model = ForumCategory
        fields = [
            "id", "name", "slug", "description", "icon", 
            "topic_count", "reply_count", "display_order", "is_active",
        ]
        read_only_fields = fields

class ForumCategoryDetailSerializer(serializers.ModelSerializer):
    """Serializer for forum category detail."""
    class Meta:
        model = ForumCategory
        fields = [
            "id", "name", "slug", "description", "icon", 
            "display_order", "is_active", "topic_count", 
            "reply_count", "created_at", "updated_at",
        ]
        read_only_fields = fields

class ForumCategoryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating forum category."""
    class Meta:
        model = ForumCategory
        fields = [
            "name", "slug", "description", "icon", 
            "display_order", "is_active",
        ]

    def validate_slug(self, value):
        from django.core.validators import slug_re
        if not slug_re.match(value):
            raise serializers.ValidationError(
                "Slug can only contain letters, numbers, underscores and hyphens."
            )
        return value
