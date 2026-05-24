from datetime import timedelta

from celery import shared_task
from django.utils import timezone


@shared_task(name="apps.blog.tasks.publish_scheduled_posts")
def publish_scheduled_posts() -> dict:
    """Publish all SCHEDULED posts whose published_at has passed."""
    from apps.blog.models import Post

    now = timezone.now()
    qs = Post.objects.filter(status=Post.Status.SCHEDULED, published_at__lte=now)
    count = qs.update(status=Post.Status.PUBLISHED)
    return {"published": count}


@shared_task(name="apps.blog.tasks.prune_post_views")
def prune_post_views(days: int = 90) -> dict:
    """Delete PostView rows older than `days` days for retention control."""
    from apps.blog.models import PostView

    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = PostView.objects.filter(viewed_at__lt=cutoff).delete()
    return {"deleted": deleted, "cutoff_days": days}
