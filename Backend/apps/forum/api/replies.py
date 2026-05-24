from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from apps.common.throttling import ForumPostThrottle

from ..models import Reply
from ..services.reply import ReplyService
from ..services.reaction import ReactionService
from ..serializers.reply import (
    ReplyListSerializer,
    ReplyDetailSerializer,
    ReplyCreateSerializer,
    ReplyUpdateSerializer,
)
from ..serializers.reaction import ReplyReactionSerializer, ReactionInputSerializer
from ..permissions import (
    CanCreateReply,
    IsForumModerator,
    IsReplyAuthorOrModerator,
)

class ReplyViewSet(viewsets.ModelViewSet):
    """ViewSet for forum replies."""
    queryset = Reply.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle]
    serializer_class = ReplyListSerializer

    def get_throttles(self):
        if self.action == "create":
            return [AnonRateThrottle(), ForumPostThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ReplyDetailSerializer
        if self.action == "create":
            return ReplyCreateSerializer
        if self.action in ["update", "partial_update"]:
            return ReplyUpdateSerializer
        return ReplyListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        if self.action == "create":
            return [CanCreateReply()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsReplyAuthorOrModerator()]
        if self.action in ["mark_solution", "unmark_solution", "hide", "unhide"]:
            return [IsForumModerator()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = Reply.objects.all()
        if self.action in ["list", "retrieve"]:
            queryset = queryset.select_related("author")
        if self.action == "retrieve":
            queryset = queryset.select_related("topic")
            
        if self.action == "list":
            queryset = queryset.prefetch_related("reactions")
            include_hidden = self.request.query_params.get("include_hidden") in ["true", "1"]
            
            # Security check for hidden content
            is_moderator = IsForumModerator().has_permission(self.request, self)
            if include_hidden and not is_moderator:
                # Should we raise 403 here? Or just ignore the flag?
                # The test test_list_replies_include_hidden_requires_moderator expects 403.
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only moderators can see hidden content.")

            if not include_hidden:
                queryset = queryset.filter(is_hidden=False)
                
            topic_slug = self.request.query_params.get("topic")
            if topic_slug:
                queryset = queryset.filter(topic__slug=topic_slug)
        return queryset

    def create(self, request):
        serializer = ReplyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            reply = ReplyService.create_reply(
                content=serializer.validated_data["content"],
                topic=serializer.validated_data["topic"],
                author=request.user,
            )
            return Response(
                ReplyDetailSerializer(reply).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        ReplyService.delete_reply(instance)

    @action(detail=True, methods=["post"])
    def mark_solution(self, request, pk=None):
        reply = self.get_object()
        ReplyService.mark_reply_as_solution(reply)
        return Response({"message": "Reply marked as solution."})

    @action(detail=True, methods=["post"])
    def unmark_solution(self, request, pk=None):
        reply = self.get_object()
        reply.is_solution = False
        reply.save(update_fields=["is_solution"])
        return Response({"message": "Solution unmarked."})

    @action(detail=True, methods=["post"])
    def hide(self, request, pk=None):
        reply = self.get_object()
        reason = request.data.get("reason", "")
        ReplyService.hide_reply(reply, reason)
        return Response({"message": "Reply hidden."})

    @action(detail=True, methods=["post"])
    def unhide(self, request, pk=None):
        reply = self.get_object()
        ReplyService.unhide_reply(reply)
        return Response({"message": "Reply unhidden."})

    @action(detail=True, methods=["post"])
    def react(self, request, pk=None):
        reply = self.get_object()
        serializer = ReactionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        reaction = ReactionService.add_reply_reaction(
            reply=reply,
            user=request.user,
            reaction=serializer.validated_data["reaction"],
        )
        if reaction:
            return Response(ReplyReactionSerializer(reaction).data, status=status.HTTP_201_CREATED)
        return Response({"message": "Reaction removed"}, status=status.HTTP_200_OK)
