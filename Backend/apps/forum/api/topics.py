from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from apps.common.throttling import ForumPostThrottle

from ..models import Topic, Reply
from ..services.topic import TopicService
from ..services.reaction import ReactionService
from ..selectors import ForumSelector
from ..serializers.topic import (
    TopicListSerializer,
    TopicDetailSerializer,
    TopicCreateSerializer,
    TopicUpdateSerializer,
)
from ..serializers.reply import ReplyListSerializer
from ..permissions import (
    CanCreateTopic,
    IsForumModerator,
    IsTopicAuthorOrModerator,
)

class TopicViewSet(viewsets.ModelViewSet):
    """ViewSet for forum topics."""
    queryset = Topic.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle]
    serializer_class = TopicListSerializer
    lookup_field = "slug"

    def get_throttles(self):
        if self.action == "create":
            return [AnonRateThrottle(), ForumPostThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TopicDetailSerializer
        if self.action == "create":
            return TopicCreateSerializer
        if self.action in ["update", "partial_update"]:
            return TopicUpdateSerializer
        return TopicListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "with_replies", "reactions", "popular"]:
            return [permissions.AllowAny()]
        if self.action == "create":
            return [CanCreateTopic()]
        if self.action in ["pin", "unpin", "close", "open", "archive", "unarchive"]:
            return [IsForumModerator()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsTopicAuthorOrModerator()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = Topic.objects.all()
        if self.action in ["list", "retrieve"]:
            queryset = queryset.select_related("author", "category", "last_reply_by")
        if self.action == "list":
            queryset = queryset.filter(category__is_active=True)
            category_param = self.request.query_params.get("category")
            if category_param:
                import uuid
                try:
                    uuid.UUID(category_param)
                    queryset = queryset.filter(category_id=category_param)
                except ValueError:
                    queryset = queryset.filter(category__slug=category_param)

            q = self.request.query_params.get("q", "").strip()
            if q:
                # _apply_search applies its own order_by when using full-text search
                return self._apply_search(queryset, q)

            return queryset.order_by("-is_pinned", "-last_reply_at")
        return queryset

    @staticmethod
    def _apply_search(qs, q: str):
        from django.db import connection
        if connection.vendor != "postgresql":
            return qs.filter(Q(title__icontains=q) | Q(content__icontains=q))

        try:
            from django.contrib.postgres.search import SearchQuery, SearchRank
            query = SearchQuery(q, config="portuguese")
            return (
                qs.filter(search_vector=query)
                .annotate(rank=SearchRank("search_vector", query))
                .order_by("-rank")
            )
        except Exception:
            return qs.filter(Q(title__icontains=q) | Q(content__icontains=q))

    def create(self, request):
        serializer = TopicCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            topic = TopicService.create_topic(
                title=serializer.validated_data["title"],
                content=serializer.validated_data["content"],
                category=serializer.validated_data["category"],
                author=request.user,
                slug=serializer.validated_data.get("slug"),
            )
            return Response(
                TopicDetailSerializer(topic).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def with_replies(self, request, slug=None):
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        
        topic, replies = ForumSelector.get_topic_with_replies(slug, page, page_size)
        if not topic:
            return Response({"error": "Topic not found"}, status=status.HTTP_404_NOT_FOUND)
            
        topic.increment_view_count()
        
        # Simple manual pagination response for now, or use standard paginator
        return Response({
            "topic": TopicDetailSerializer(topic, context={"request": request}).data,
            "replies": ReplyListSerializer(replies, many=True, context={"request": request}).data,
        })

    @action(detail=True, methods=["post"])
    def pin(self, request, slug=None):
        topic = self.get_object()
        TopicService.pin_topic(topic)
        return Response({"message": "Topic pinned."})

    @action(detail=True, methods=["post"])
    def unpin(self, request, slug=None):
        topic = self.get_object()
        TopicService.unpin_topic(topic)
        return Response({"message": "Topic unpinned."})

    @action(detail=True, methods=["post"])
    def close(self, request, slug=None):
        topic = self.get_object()
        TopicService.lock_topic(topic)
        return Response({"message": "Topic closed."})

    @action(detail=True, methods=["post"])
    def open(self, request, slug=None):
        topic = self.get_object()
        TopicService.unlock_topic(topic)
        return Response({"message": "Topic opened."})

    @action(detail=True, methods=["post"])
    def archive(self, request, slug=None):
        topic = self.get_object()
        TopicService.archive_topic(topic)
        return Response({"message": "Topic archived."})

    @action(detail=True, methods=["post"])
    def unarchive(self, request, slug=None):
        topic = self.get_object()
        TopicService.unarchive_topic(topic)
        return Response({"message": "Topic unarchived."})

    @action(detail=True, methods=["get"])
    def reactions(self, request, slug=None):
        topic = self.get_object()
        reactions = ReactionService.get_topic_reactions(topic)
        return Response(reactions)

    @action(detail=False, methods=["get"])
    def popular(self, request):
        limit = int(request.query_params.get("limit", 5))
        topics = ForumSelector.get_popular_topics(limit=limit)
        return Response(TopicListSerializer(topics, many=True, context={"request": request}).data)

    def perform_destroy(self, instance):
        TopicService.delete_topic(instance)
