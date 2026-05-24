import os

from django.core.management.base import CommandError
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Ensure a default support user exists (intended for local/dev)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        force = bool(options.get("force"))
        enabled = os.environ.get("CREATE_DEFAULT_SUPPORT_USER", "False").lower() == "true"
        if not enabled and not force:
            return

        username = os.environ.get("SUPPORT_USER_USERNAME", "suporte").strip() or "suporte"
        email = os.environ.get("SUPPORT_USER_EMAIL", "suporte@raven.local").strip() or "suporte@raven.local"
        password = (os.environ.get("SUPPORT_USER_PASSWORD") or "").strip()
        if not password:
            raise CommandError("Set SUPPORT_USER_PASSWORD to create/update the support user.")

        user = User.all_objects.filter(email=email).first()
        created = False
        if not user:
            user = User.objects.create_user(username=username, email=email, password=password)
            created = True
        else:
            if user.username != username:
                user.username = username
            user.email = email
            user.is_active = True
            user.is_verified = True
            user.set_password(password)
            user.save()

        if not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])
        if not user.is_verified:
            user.is_verified = True
            user.save(update_fields=["is_verified"])

        self.stdout.write(self.style.SUCCESS("Support user created." if created else "Support user updated."))
