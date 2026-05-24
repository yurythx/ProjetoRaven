from rest_framework import serializers

class AuthorSerializer(serializers.Serializer):
    """Minimal author serializer for nested use."""
    id = serializers.UUIDField(read_only=True)
    username = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)
