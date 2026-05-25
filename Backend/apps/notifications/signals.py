from django.db.models.signals import post_save
from django.dispatch import receiver


def _create_notification(recipient, verb, actor_name, message, target_url=""):
    """Safe helper — never raises, so signals never break the main flow."""
    try:
        from .models import Notification
        Notification.objects.create(
            recipient=recipient,
            verb=verb,
            actor_name=actor_name,
            message=message,
            target_url=target_url,
        )
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
