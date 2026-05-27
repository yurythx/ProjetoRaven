"""Read-only queries for blog comments (Selector layer)."""
from django.db.models import QuerySet
from typing import Optional

from apps.blog.models import Comment


class CommentSelector:
    """Selector for read-only blog comment queries."""

    @staticmethod
    def get_approved_for_post(post_slug: str) -> QuerySet:
        """Return approved top-level comments for a published post."""
        return (
            Comment.objects.filter(
                post__slug=post_slug,
                post__status="published",
                post__is_public=True,
                is_approved=True,
                is_public=True,
                parent__isnull=True,
            )
            .select_related("author")
            .prefetch_related("replies__author")
            .order_by("created_at")
        )

    @staticmethod
    def get_pending_moderation() -> QuerySet:
        """Return comments awaiting moderation, newest first."""
        return (
            Comment.objects.filter(is_approved=False, is_public=True)
            .select_related("author", "post")
            .order_by("-created_at")
        )

    @staticmethod
    def get_admin_list(*, post_slug: Optional[str] = None) -> QuerySet:
        """Return all comments for admin views."""
        qs = Comment.objects.all().select_related("author", "post", "parent")
        if post_slug:
            qs = qs.filter(post__slug=post_slug)
        return qs.order_by("-created_at")
