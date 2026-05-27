def _broadcast_notification(notification) -> None:
    """Push the saved Notification to the user's WebSocket group (fire-and-forget)."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from .serializers import NotificationSerializer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        payload = NotificationSerializer(notification).data
        # UUIDs aren't JSON-serialisable by default — serializer already converts them
        async_to_sync(channel_layer.group_send)(
            f"notifications_user_{notification.recipient_id}",
            {"type": "new_notification", "notification": payload},
        )
    except Exception:
        pass


def _create_notification(recipient, verb, actor_name, message, target_url=""):
    """Safe helper — never raises, so callers never break the main flow."""
    try:
        from .models import Notification

        notif = Notification.objects.create(
            recipient=recipient,
            verb=verb,
            actor_name=actor_name,
            message=message,
            target_url=target_url,
        )
        _broadcast_notification(notif)
    except Exception:
        pass


def notify_forum_reply(topic, reply):
    """Call from forum reply service when a new reply is saved."""
    if topic.author_id == reply.author_id:
        return
    from django.conf import settings

    site_url = getattr(settings, "SITE_URL", "").rstrip("/")
    actor = reply.author.display_name or reply.author.username
    _create_notification(
        recipient=topic.author,
        verb="forum_reply",
        actor_name=actor,
        message=f'{actor} respondeu ao seu tópico "{topic.title}".',
        target_url=f"{site_url}/forum/t/{topic.slug}",
    )


def notify_blog_comment(post, comment):
    """Call from blog comment service when a new comment is saved."""
    if post.author_id == comment.author_id:
        return
    from django.conf import settings

    site_url = getattr(settings, "SITE_URL", "").rstrip("/")
    actor = comment.author.display_name or comment.author.username
    _create_notification(
        recipient=post.author,
        verb="blog_comment",
        actor_name=actor,
        message=f'{actor} comentou no seu artigo "{post.title}".',
        target_url=f"{site_url}/blog/{post.slug}",
    )
    # Web Push — runs after the in-app notification is persisted
    try:
        from apps.accounts.services.push import send_push_to_user

        send_push_to_user(
            post.author,
            title="Novo comentário no seu artigo",
            body=f'{actor} comentou: "{post.title}"',
            url=f"{site_url}/blog/{post.slug}",
        )
    except Exception:
        pass
