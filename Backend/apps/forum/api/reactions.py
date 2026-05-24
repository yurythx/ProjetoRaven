from rest_framework import viewsets, status, permissions
from rest_framework.response import Response

from ..models import Topic, Reply, TopicReaction, ReplyReaction
from ..services.reaction import ReactionService
from ..serializers.reaction import (
    TopicReactionSerializer,
    ReplyReactionSerializer,
    ReactionInputSerializer,
)

class TopicReactionViewSet(viewsets.GenericViewSet):
    """ViewSet for topic reactions."""
    queryset = TopicReaction.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TopicReactionSerializer

    def create(self, request):
        serializer = ReactionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        topic_id = request.data.get("topic_id")
        if not topic_id:
            return Response({"error": "topic_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            topic = Topic.objects.get(id=topic_id)
            reaction = ReactionService.add_topic_reaction(
                topic=topic,
                user=request.user,
                reaction=serializer.validated_data["reaction"],
            )
            if reaction:
                return Response(TopicReactionSerializer(reaction).data, status=status.HTTP_201_CREATED)
            return Response({"message": "Reaction removed"}, status=status.HTTP_200_OK)
        except Topic.DoesNotExist:
            return Response({"error": "Topic not found."}, status=status.HTTP_404_NOT_FOUND)

class ReplyReactionViewSet(viewsets.GenericViewSet):
    """ViewSet for reply reactions."""
    queryset = ReplyReaction.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReplyReactionSerializer

    def create(self, request):
        serializer = ReactionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        reply_id = request.data.get("reply_id")
        if not reply_id:
            return Response({"error": "reply_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            reply = Reply.objects.get(id=reply_id)
            reaction = ReactionService.add_reply_reaction(
                reply=reply,
                user=request.user,
                reaction=serializer.validated_data["reaction"],
            )
            if reaction:
                return Response(ReplyReactionSerializer(reaction).data, status=status.HTTP_201_CREATED)
            return Response({"message": "Reaction removed"}, status=status.HTTP_200_OK)
        except Reply.DoesNotExist:
            return Response({"error": "Reply not found."}, status=status.HTTP_404_NOT_FOUND)
