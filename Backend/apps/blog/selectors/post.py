"""
Read-only queries for blog posts (Selector layer).

These functions encapsulate all read-path query logic so views stay thin
and the same queries can be reused across views, management commands, and tests.
Write operations belong in PostService / PostRepository.
"""
from django.db.models import Q, QuerySet
from typing import Optional

from apps.blog.models import Post


def _base_published() -> QuerySet:
    return (
        Post.objects.filter(status=Post.Status.PUBLISHED, is_public=True)
        .select_related("author", "category")
        .prefetch_related("tags")
    )


def _base_admin() -> QuerySet:
    return (
        Post.objects.all()
        .select_related("author", "category")
        .prefetch_related("tags")
    )


class PostSelector:
    """Selector for read-only blog post queries."""

    @staticmethod
    def get_published(
        *,
        category_slug: Optional[str] = None,
        tag_slug: Optional[str] = None,
        author=None,
        featured: Optional[bool] = None,
        ordering: str = "-published_at",
    ) -> QuerySet:
        """Return published public posts with optional filters."""
        allowed_orderings = {"-published_at", "published_at", "-view_count", "view_count"}
        qs = _base_published()
        if category_slug:
            qs = qs.filter(category__slug=category_slug)
        if tag_slug:
            qs = qs.filter(tags__slug=tag_slug)
        if author is not None:
            qs = qs.filter(author=author)
        if featured is not None:
            qs = qs.filter(is_featured=featured)
        return qs.order_by(ordering if ordering in allowed_orderings else "-published_at")

    @staticmethod
    def get_by_slug(slug: str) -> Optional[Post]:
        """Return a single published public post by slug, or None."""
        return _base_published().filter(slug=slug).first()

    @staticmethod
    def search_published(query: str) -> QuerySet:
        """Full-text search on published posts (PostgreSQL); falls back to icontains."""
        qs = _base_published()
        try:
            from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

            vector = (
                SearchVector("title", weight="A")
                + SearchVector("excerpt", weight="B")
                + SearchVector("content", weight="C")
            )
            sq = SearchQuery(query)
            return qs.annotate(rank=SearchRank(vector, sq)).filter(rank__gte=0.01).order_by("-rank")
        except Exception:
            return qs.filter(Q(title__icontains=query) | Q(excerpt__icontains=query))

    @staticmethod
    def get_featured(limit: int = 6) -> QuerySet:
        """Return the most-recent featured published posts."""
        return _base_published().filter(is_featured=True).order_by("-published_at")[:limit]

    # ── Admin / editor queries ────────────────────────────────────────────────

    @staticmethod
    def get_admin_list(
        *,
        status: Optional[str] = None,
        author=None,
        ordering: str = "-created_at",
    ) -> QuerySet:
        """Return all posts for staff/editor views, with optional filters."""
        qs = _base_admin()
        if status:
            qs = qs.filter(status=status)
        if author is not None:
            qs = qs.filter(author=author)
        return qs.order_by(ordering)

    @staticmethod
    def get_admin_by_slug(slug: str) -> Optional[Post]:
        """Return any post by slug for admin/editor access."""
        return _base_admin().filter(slug=slug).first()

    @staticmethod
    def get_pending_review() -> QuerySet:
        """Return posts waiting for editorial review."""
        return _base_admin().filter(status=Post.Status.PENDING).order_by("created_at")

    @staticmethod
    def get_scheduled() -> QuerySet:
        """Return posts scheduled for future publication."""
        return _base_admin().filter(status=Post.Status.SCHEDULED).order_by("published_at")
