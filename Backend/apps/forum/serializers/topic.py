from rest_framework import serializers
from ..models import Topic
from .author import AuthorSerializer
from .category import ForumCategoryListSerializer

class TopicListSerializer(serializers.ModelSerializer):
    """Serializer for topic list."""
    author = AuthorSerializer(read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    last_reply_by = AuthorSerializer(read_only=True)

    class Meta:
        model = Topic
        fields = [
            "id", "title", "slug", "author", "category", "category_name",
            "status", "reply_count", "view_count", "is_pinned", "is_locked",
            "last_reply_at", "last_reply_by", "created_at", "updated_at",
        ]
        read_only_fields = fields

class TopicDetailSerializer(serializers.ModelSerializer):
    """Serializer for topic detail."""
    author = AuthorSerializer(read_only=True)
    category = ForumCategoryListSerializer(read_only=True)
    last_reply_by = AuthorSerializer(read_only=True)

    class Meta:
        model = Topic
        fields = [
            "id", "title", "slug", "content", "author", "category",
            "status", "reply_count", "view_count", "is_pinned", "is_locked",
            "last_reply_at", "last_reply_by", "created_at", "updated_at",
        ]
        read_only_fields = fields

class TopicCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating topics."""
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Topic
        fields = ["title", "slug", "content", "category"]

    def validate_content(self, value):
        from apps.common.html_sanitizer import sanitize_html
        return sanitize_html(value)

    def validate_slug(self, value):
        from django.core.validators import slug_re
        if value and not slug_re.match(value):
            raise serializers.ValidationError(
                "Slug can only contain letters, numbers, underscores and hyphens."
            )
        if value and Topic.objects.filter(slug=value).exists():
            raise serializers.ValidationError("A topic with this slug already exists.")
        return value

    def validate_category(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot post to inactive category.")
        return value

class TopicUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating topics."""
    class Meta:
        model = Topic
        fields = ["title", "slug", "content"]

    def validate_content(self, value):
        from apps.common.html_sanitizer import sanitize_html
        return sanitize_html(value)

    def validate_slug(self, value):
        from django.core.validators import slug_re
        if not slug_re.match(value):
            raise serializers.ValidationError(
                "Slug can only contain letters, numbers, underscores and hyphens."
            )
        if Topic.objects.filter(slug=value).exclude(id=self.instance.id).exists():
            raise serializers.ValidationError("A topic with this slug already exists.")
        return value
