from django.db import transaction, models
from ..models import Topic, Reply, ForumCategory
from ..repositories.reply import ReplyRepository, DjangoReplyRepository


def _notify_topic_author(topic: Topic, reply: Reply) -> None:
    """Send a WebPush notification to the topic author on a new reply (not from themselves)."""
    try:
        if topic.author_id == reply.author_id:
            return
        from apps.accounts.services.push import send_push_to_user
        from django.conf import settings
        site_url = getattr(settings, "NEXT_PUBLIC_SITE_URL", "")
        send_push_to_user(
            topic.author,
            title="Nova resposta no seu tópico",
            body=f'{reply.author.display_name or reply.author.username} respondeu: "{topic.title}"',
            url=f"{site_url}/forum/topico/{topic.slug}",
        )
    except Exception:
        pass


def _notify_in_app(topic: Topic, reply: Reply) -> None:
    """Create an in-app notification for the topic author."""
    try:
        from apps.notifications.signals import notify_forum_reply
        notify_forum_reply(topic, reply)
    except Exception:
        pass


def _broadcast_new_reply(topic_slug: str, reply: Reply) -> None:
    """Send a WebSocket message to all topic subscribers after DB commit."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        payload = {
            "id": str(reply.id),
            "content": reply.content,
            "author_name": reply.author.display_name or reply.author.username,
            "created_at": reply.created_at.isoformat(),
            "is_solution": reply.is_solution,
        }
        async_to_sync(channel_layer.group_send)(
            f"forum_topic_{topic_slug}",
            {"type": "new_reply", "reply": payload},
        )
    except Exception:
        pass


class ReplyService:
    """Service for reply operations."""

    @staticmethod
    @transaction.atomic
    def create_reply(
        topic: Topic,
        content: str,
        author,
        repository: ReplyRepository = None,
    ) -> Reply:
        """Create a reply to a topic."""
        if repository is None:
            repository = DjangoReplyRepository()
        from apps.common.html_sanitizer import sanitize_html

        # Lock the topic for counter update
        topic = Topic.objects.select_for_update().get(id=topic.id)

        if topic.is_locked:
            raise ValueError("Cannot reply to a locked topic.")

        reply = repository.create(
            topic=topic,
            content=sanitize_html(content),
            author=author,
        )

        topic.increment_reply_count(reply_author=author)

        ForumCategory.objects.select_for_update().filter(id=topic.category_id).update(
            reply_count=models.F("reply_count") + 1
        )

        slug = topic.slug
        _topic_snapshot = topic
        _reply_snapshot = reply
        transaction.on_commit(lambda: _broadcast_new_reply(slug, _reply_snapshot))
        transaction.on_commit(lambda: _notify_topic_author(_topic_snapshot, _reply_snapshot))
        transaction.on_commit(lambda: _notify_in_app(_topic_snapshot, _reply_snapshot))

        return reply

    @staticmethod
    @transaction.atomic
    def delete_reply(reply: Reply, repository: ReplyRepository = None) -> None:
        """Delete a reply and update counters."""
        if repository is None:
            repository = DjangoReplyRepository()
        topic = reply.topic
        topic.decrement_reply_count()

        ForumCategory.objects.filter(id=topic.category_id).update(
            reply_count=models.F("reply_count") - 1
        )

        repository.delete(reply)

    @staticmethod
    @transaction.atomic
    def mark_reply_as_solution(reply: Reply) -> Reply:
        """Mark a reply as solution."""
        Reply.objects.filter(topic=reply.topic, is_solution=True).update(is_solution=False)
        reply.mark_as_solution()
        return reply

    @staticmethod
    @transaction.atomic
    def hide_reply(reply: Reply, reason: str = "") -> Reply:
        """Hide a reply (moderator action)."""
        reply.hide(reason)
        return reply

    @staticmethod
    @transaction.atomic
    def unhide_reply(reply: Reply) -> Reply:
        """Unhide a previously hidden reply."""
        reply.unhide()
        return reply
