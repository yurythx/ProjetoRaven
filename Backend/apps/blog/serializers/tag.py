from rest_framework import serializers
from apps.blog.models import Tag

class TagSerializer(serializers.ModelSerializer):
    """Serializer for tags."""

    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]
