from django.db.models import QuerySet, Q
from typing import Optional, Tuple
from .models import Topic, Reply, ForumCategory

class ForumSelector:
    """Selector for complex forum queries."""

    @staticmethod
    def get_topics_by_category(
        category_slug: str,
        page: int = 1,
        page_size: int = 20,
    ) -> QuerySet:
        offset = (page - 1) * page_size
        return Topic.objects.filter(
            category__slug=category_slug,
            status=Topic.Status.OPEN
        ).select_related("author", "category", "last_reply_by")[offset:offset + page_size]

    @staticmethod
    def get_recent_topics(page: int = 1, page_size: int = 20) -> QuerySet:
        offset = (page - 1) * page_size
        return Topic.objects.filter(
            status=Topic.Status.OPEN
        ).select_related("author", "category", "last_reply_by").order_by("-last_reply_at")[offset:offset + page_size]

    @staticmethod
    def get_topic_with_replies(topic_slug: str, page: int = 1, page_size: int = 20) -> Tuple[Optional[Topic], QuerySet]:
        topic = Topic.objects.select_related(
            "author", "category", "last_reply_by"
        ).filter(slug=topic_slug).first()
        
        if not topic:
            return None, Reply.objects.none()

        offset = (page - 1) * page_size
        replies = Reply.objects.filter(
            topic=topic,
            is_hidden=False
        ).select_related("author").prefetch_related("reactions")[offset:offset + page_size]

        return topic, replies

    @staticmethod
    def search_topics(query: str, page: int = 1, page_size: int = 20) -> QuerySet:
        offset = (page - 1) * page_size
        return Topic.objects.filter(
            Q(title__icontains=query) | Q(content__icontains=query)
        ).select_related("author", "category", "last_reply_by")[offset:offset + page_size]

    @staticmethod
    def get_popular_topics(limit: int = 5) -> QuerySet:
        return Topic.objects.filter(status=Topic.Status.OPEN).order_by(
            "-reply_count", "-view_count"
        ).select_related("author", "category")[:limit]
