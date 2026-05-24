from django.core.management.base import BaseCommand
from django.db import transaction

from apps.forum.models import Topic


class Command(BaseCommand):
    help = "Ensure Topic.slug is unique by renaming duplicates safely."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))

        seen = set()
        updated = 0

        for topic in Topic.objects.order_by("created_at", "id").only("id", "slug"):
            base = (topic.slug or "").strip() or "topic"
            if base not in seen and not Topic.objects.exclude(id=topic.id).filter(slug=base).exists():
                seen.add(base)
                continue

            i = 2
            while True:
                candidate = f"{base}-{i}"
                if candidate not in seen and not Topic.objects.exclude(id=topic.id).filter(slug=candidate).exists():
                    break
                i += 1

            self.stdout.write(f"{topic.id}: {topic.slug} -> {candidate}")
            if not dry_run:
                Topic.objects.filter(id=topic.id).update(slug=candidate)
            seen.add(candidate)
            updated += 1

        self.stdout.write(self.style.SUCCESS(f"Updated {updated} topics."))

