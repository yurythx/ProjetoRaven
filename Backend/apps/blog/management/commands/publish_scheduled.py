"""
Management command: publish_scheduled

Publishes blog posts whose status is SCHEDULED and whose published_at
timestamp is in the past (or now).  Safe to run repeatedly — already-
published posts are never touched.

Usage:
    python manage.py publish_scheduled            # live run
    python manage.py publish_scheduled --dry-run  # preview only

Designed to be called from a simple cron loop:
    while true; do python manage.py publish_scheduled; sleep 60; done
"""
import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.blog.models import Post

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Publish SCHEDULED posts whose published_at timestamp has passed."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be published without making changes.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        now = timezone.now()

        due = Post.objects.filter(
            status=Post.Status.SCHEDULED,
            published_at__lte=now,
        ).select_related("author")

        count = due.count()
        if count == 0:
            self.stdout.write("No scheduled posts due for publication.")
            return

        if dry_run:
            self.stdout.write(f"[dry-run] {count} post(s) would be published:")
            for post in due:
                self.stdout.write(f"  • {post.slug!r} (scheduled for {post.published_at})")
            return

        published = 0
        errors = 0

        for post in due:
            try:
                with transaction.atomic():
                    # Use the model method so status machine is respected
                    Post.objects.filter(pk=post.pk).update(
                        status=Post.Status.PUBLISHED,
                        is_public=True,
                    )
                    published += 1
                    logger.info("auto_published slug=%s", post.slug)
                    self.stdout.write(
                        self.style.SUCCESS(f"Published: {post.slug!r}")
                    )
            except Exception as exc:
                errors += 1
                logger.error("publish_failed slug=%s error=%s", post.slug, exc)
                self.stdout.write(
                    self.style.ERROR(f"Failed: {post.slug!r} — {exc}")
                )

        summary = f"{published} published"
        if errors:
            summary += f", {errors} error(s)"
        self.stdout.write(self.style.SUCCESS(f"Done — {summary}."))
