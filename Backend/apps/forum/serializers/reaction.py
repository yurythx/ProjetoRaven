from rest_framework import serializers
from ..models import TopicReaction, ReplyReaction
from .author import AuthorSerializer

class TopicReactionSerializer(serializers.ModelSerializer):
    """Serializer for topic reactions."""
    user = AuthorSerializer(read_only=True)

    class Meta:
        model = TopicReaction
        fields = ["id", "user", "topic", "reaction", "created_at"]
        read_only_fields = fields

class ReplyReactionSerializer(serializers.ModelSerializer):
    """Serializer for reply reactions."""
    user = AuthorSerializer(read_only=True)

    class Meta:
        model = ReplyReaction
        fields = ["id", "user", "reply", "reaction", "created_at"]
        read_only_fields = fields

class ReactionInputSerializer(serializers.Serializer):
    """Serializer for adding reactions."""
    reaction = serializers.ChoiceField(choices=TopicReaction.ReactionType.choices)
