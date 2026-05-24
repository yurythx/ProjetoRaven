from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone


class Command(BaseCommand):
    help = "Remove OTPs expirados/consumidos antigos."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=None)
        parser.add_argument("--dry-run", action="store_true", default=False)

    def handle(self, *args, **options):
        from django.conf import settings
        from apps.accounts.models import EmailOneTimeCode

        days = options["days"]
        if days is None:
            days = int(getattr(settings, "ACCOUNTS_OTP_CLEANUP_AFTER_DAYS", 7))

        cutoff = timezone.now() - timedelta(days=int(days))

        expired_q = Q(expires_at__lt=cutoff)
        consumed_q = Q(consumed_at__isnull=False, created_at__lt=cutoff)
        qs = EmailOneTimeCode.objects.filter(expired_q | consumed_q)

        expired_count = EmailOneTimeCode.objects.filter(expired_q).count()
        consumed_count = EmailOneTimeCode.objects.filter(consumed_q).count()
        total = qs.count()
        if options["dry_run"]:
            self.stdout.write(f"[dry-run] Would delete {total} OTPs (expired={expired_count}, consumed={consumed_count}) older than {days} day(s).")
            return

        deleted, _ = qs.delete()
        self.stdout.write(f"Deleted {deleted} OTPs (expired={expired_count}, consumed={consumed_count}) older than {days} day(s).")
