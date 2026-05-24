from rest_framework import serializers
from ..models import Reply
from .author import AuthorSerializer

class ReplyListSerializer(serializers.ModelSerializer):
    """Serializer for reply list."""
    author = AuthorSerializer(read_only=True)
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = Reply
        fields = [
            "id", "content", "author", "topic", "is_solution",
            "is_hidden", "reactions", "edited_at", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_reactions(self, obj):
        from ..services.reaction import ReactionService
        return ReactionService.get_reply_reactions(obj)

class ReplyDetailSerializer(serializers.ModelSerializer):
    """Serializer for reply detail."""
    author = AuthorSerializer(read_only=True)
    topic_title = serializers.CharField(source="topic.title", read_only=True)

    class Meta:
        model = Reply
        fields = [
            "id", "content", "author", "topic", "topic_title",
            "is_solution", "is_hidden", "hidden_reason",
            "edited_at", "created_at", "updated_at",
        ]
        read_only_fields = fields

class ReplyCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating replies."""
    class Meta:
        model = Reply
        fields = ["content", "topic"]

    def validate_content(self, value):
        from apps.common.html_sanitizer import sanitize_html
        return sanitize_html(value)

class ReplyUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating replies."""
    class Meta:
        model = Reply
        fields = ["content"]

    def validate_content(self, value):
        from apps.common.html_sanitizer import sanitize_html
        return sanitize_html(value)
