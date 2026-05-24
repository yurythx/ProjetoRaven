from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.blog.models import PostView


class Command(BaseCommand):
    help = "Delete old PostView rows for retention control."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=90)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        days = int(options.get("days") or 90)
        dry_run = bool(options.get("dry_run"))

        cutoff = timezone.now() - timedelta(days=days)
        qs = PostView.objects.filter(viewed_at__lt=cutoff)
        count = qs.count()

        if dry_run:
            self.stdout.write(f"Would delete {count} PostView rows older than {days} days.")
            return

        deleted, _ = qs.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} PostView rows older than {days} days."))

