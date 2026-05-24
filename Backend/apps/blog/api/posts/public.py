from django.db.models import Q
from rest_framework import viewsets, permissions, response
from rest_framework.decorators import action

from ...repositories.post import DjangoPostRepository
from ...serializers.post import PostListSerializer, PostDetailSerializer, PublicPostDetailSerializer


def _fulltext_search(qs, q: str):
    """
    Full-text search using PostgreSQL SearchVector.
    Falls back to icontains when running on SQLite (CI/test).
    """
    try:
        from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
        vector = (
            SearchVector("title", weight="A")
            + SearchVector("excerpt", weight="B")
            + SearchVector("content", weight="C")
        )
        query = SearchQuery(q)
        return qs.annotate(rank=SearchRank(vector, query)).filter(rank__gte=0.01).order_by("-rank")
    except Exception:
        return qs.filter(Q(title__icontains=q) | Q(excerpt__icontains=q))


class PublicPostViewSet(viewsets.ReadOnlyModelViewSet):
    """ReadOnly viewset for public posts."""
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return DjangoPostRepository().get_all().select_related("author").filter(status="published", is_public=True)

    def get_serializer_class(self):
        if self.action in ["list", "featured", "search"]:
            return PostListSerializer
        return PublicPostDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        from django.db.models import F
        from ...models import Post
        instance = self.get_object()
        # Increment view count atomically
        Post.objects.filter(pk=instance.pk).update(view_count=F("view_count") + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return response.Response(serializer.data)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()

        category_slug = request.query_params.get("category", "").strip()
        if category_slug:
            qs = qs.filter(category__slug=category_slug)

        tag_slug = request.query_params.get("tag", "").strip()
        if tag_slug:
            qs = qs.filter(tags__slug=tag_slug)

        q = request.query_params.get("q", "").strip()
        if q:
            qs = _fulltext_search(qs, q)
        else:
            ordering = request.query_params.get("ordering", "-published_at")
            allowed = {"-published_at", "-view_count", "published_at", "view_count"}
            qs = qs.order_by(ordering if ordering in allowed else "-published_at")

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return response.Response(serializer.data)

    @action(detail=False, methods=["get"])
    def featured(self, request):
        qs = self.get_queryset().filter(is_featured=True)
        serializer = self.get_serializer(qs, many=True)
        return response.Response(serializer.data)

    @action(detail=False, methods=["get"])
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return response.Response([])
        qs = _fulltext_search(self.get_queryset(), q)
        serializer = self.get_serializer(qs, many=True)
        return response.Response(serializer.data)
