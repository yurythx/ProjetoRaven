from django.db import transaction, models
from typing import Optional
from ..models import Topic, ForumCategory
from ..repositories.topic import TopicRepository, DjangoTopicRepository

class TopicService:
    """Service for topic operations."""

    @staticmethod
    @transaction.atomic
    def create_topic(
        title: str,
        content: str,
        author,
        category: ForumCategory,
        slug: str = None,
        repository: TopicRepository = None,
    ) -> Topic:
        """Create a new topic."""
        if repository is None:
            repository = DjangoTopicRepository()
        from apps.common.html_sanitizer import sanitize_html, sanitize_plain_text
        from django.utils.text import slugify

        if slug is None:
            slug = slugify(title)[:200]
        slug = (slug or "").strip()
        if not slug:
            raise ValueError("slug is required.")
        
        if repository.get_by_slug(slug):
            raise ValueError("A topic with this slug already exists.")

        topic = repository.create(
            title=sanitize_plain_text(title or "").strip(),
            slug=slug,
            content=sanitize_html(content),
            author=author,
            category=category,
        )

        # Update category counter
        ForumCategory.objects.select_for_update().filter(id=category.id).update(
            topic_count=models.F("topic_count") + 1
        )

        return topic

    @staticmethod
    @transaction.atomic
    def delete_topic(topic: Topic, repository: TopicRepository = None) -> None:
        if repository is None:
            repository = DjangoTopicRepository()
        from ..models import Reply
        replies_count = Reply.objects.filter(topic=topic).count()
        ForumCategory.objects.filter(id=topic.category_id).update(
            topic_count=models.F("topic_count") - 1,
            reply_count=models.F("reply_count") - replies_count,
        )
        repository.delete(topic)

    @staticmethod
    @transaction.atomic
    def pin_topic(topic: Topic) -> Topic:
        topic.pin()
        return topic

    @staticmethod
    @transaction.atomic
    def unpin_topic(topic: Topic) -> Topic:
        topic.unpin()
        return topic

    @staticmethod
    @transaction.atomic
    def lock_topic(topic: Topic) -> Topic:
        topic.close()
        return topic

    @staticmethod
    @transaction.atomic
    def unlock_topic(topic: Topic) -> Topic:
        topic.open()
        return topic

    @staticmethod
    @transaction.atomic
    def archive_topic(topic: Topic) -> Topic:
        topic.status = Topic.Status.ARCHIVED
        topic.save(update_fields=["status"])
        return topic

    @staticmethod
    @transaction.atomic
    def unarchive_topic(topic: Topic) -> Topic:
        topic.status = Topic.Status.OPEN
        topic.save(update_fields=["status"])
        return topic

    @staticmethod
    def increment_view_count(topic_id, repository: TopicRepository = None) -> None:
        if repository is None:
            repository = DjangoTopicRepository()
        repository.increment_view_count(topic_id)

    @staticmethod
    def create_reply(*args, **kwargs):
        """Proxy for compatibility with old tests."""
        from .reply import ReplyService
        return ReplyService.create_reply(*args, **kwargs)

    @staticmethod
    def delete_reply(*args, **kwargs):
        """Proxy for compatibility with old tests."""
        from .reply import ReplyService
        return ReplyService.delete_reply(*args, **kwargs)
