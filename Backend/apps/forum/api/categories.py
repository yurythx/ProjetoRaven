from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.common.throttling import ResilientAnonRateThrottle, ResilientUserRateThrottle

from ..models import ForumCategory
from ..services.category import ForumCategoryService
from ..serializers.category import (
    ForumCategoryListSerializer,
    ForumCategoryDetailSerializer,
    ForumCategoryCreateSerializer,
)
from ..permissions import IsForumModerator

class ForumCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for forum categories (Admin/Moderator)."""
    queryset = ForumCategory.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_classes = [ResilientAnonRateThrottle, ResilientUserRateThrottle]
    serializer_class = ForumCategoryListSerializer
    lookup_field = "slug"

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "all"]:
            return [IsForumModerator()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ForumCategoryDetailSerializer
        if self.action in ["create", "update", "partial_update"]:
            return ForumCategoryCreateSerializer
        return ForumCategoryListSerializer

    def get_queryset(self):
        if self.action in ["list", "retrieve"]:
            return ForumCategory.objects.filter(is_active=True)
        return ForumCategory.objects.all()

    def create(self, request):
        serializer = ForumCategoryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = ForumCategoryService()
        category = service.create_category(**serializer.validated_data)
        
        return Response(
            ForumCategoryDetailSerializer(category).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def all(self, request):
        """Get all categories including inactive."""
        categories = ForumCategory.objects.all()
        serializer = ForumCategoryDetailSerializer(categories, many=True)
        return Response(serializer.data)

from apps.common.pagination import StandardResultsSetPagination

class PublicForumCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Public read-only view for categories."""
    queryset = ForumCategory.objects.filter(is_active=True)
    permission_classes = [permissions.AllowAny]
    serializer_class = ForumCategoryListSerializer
    lookup_field = "slug"
    throttle_classes = [ResilientAnonRateThrottle, ResilientUserRateThrottle]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ForumCategoryDetailSerializer
        return ForumCategoryListSerializer
