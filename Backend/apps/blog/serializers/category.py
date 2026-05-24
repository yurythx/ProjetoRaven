from rest_framework import serializers
from apps.blog.models import Category, Post

class CategorySerializer(serializers.ModelSerializer):
    """Serializer for categories."""

    post_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "display_order", "is_active", "post_count"]

    def get_post_count(self, obj):
        v = getattr(obj, "post_count", None)
        if v is not None:
            return int(v)
        return obj.posts.filter(status=Post.Status.PUBLISHED, is_public=True).count()


class CategoryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating categories."""

    class Meta:
        model = Category
        fields = ["name", "slug", "description", "display_order", "is_active"]
