from rest_framework import viewsets, permissions, response
from rest_framework.decorators import action

from ...selectors.post import PostSelector
from ...serializers.post import PostListSerializer, PublicPostDetailSerializer


class PublicPostViewSet(viewsets.ReadOnlyModelViewSet):
    """ReadOnly viewset for public posts."""
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return PostSelector.get_published()

    def get_serializer_class(self):
        if self.action in ["list", "featured", "search"]:
            return PostListSerializer
        return PublicPostDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        from django.db.models import F
        from ...models import Post
        instance = self.get_object()
        Post.objects.filter(pk=instance.pk).update(view_count=F("view_count") + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return response.Response(serializer.data)

    def list(self, request, *args, **kwargs):
        from django.contrib.auth import get_user_model
        ordering = request.query_params.get("ordering", "-published_at")

        author_username = request.query_params.get("author", "").strip() or None
        author = None
        if author_username:
            try:
                author = get_user_model().objects.get(username=author_username, is_active=True)
            except get_user_model().DoesNotExist:
                from rest_framework.response import Response
                return Response({"count": 0, "next": None, "previous": None, "results": []})

        qs = PostSelector.get_published(
            category_slug=request.query_params.get("category", "").strip() or None,
            tag_slug=request.query_params.get("tag", "").strip() or None,
            author=author,
            ordering=ordering,
        )

        q = request.query_params.get("q", "").strip()
        if q:
            qs = PostSelector.search_published(q)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return response.Response(serializer.data)

    @action(detail=False, methods=["get"])
    def featured(self, request):
        qs = PostSelector.get_featured()
        serializer = self.get_serializer(qs, many=True)
        return response.Response(serializer.data)

    @action(detail=False, methods=["get"])
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return response.Response([])
        qs = PostSelector.search_published(q)
        serializer = self.get_serializer(qs, many=True)
        return response.Response(serializer.data)
