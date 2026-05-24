"""
Management command to promote an existing user to superadmin.

Usage:
    python manage.py promote_superadmin <email>

Example (Docker):
    docker exec raven-django python manage.py promote_superadmin yurymenezes@hotmail.com
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()

ALL_GROUPS = ["players", "blog_editors", "forum_moderators"]


class Command(BaseCommand):
    help = "Promote an existing user to superadmin with full access"

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="Email of the user to promote")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f"User with email '{email}' not found.")

        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_verified = True
        user.is_admin_verified = True
        user.is_banned = False
        user.ban_reason = ""
        user.save(update_fields=[
            "is_staff", "is_superuser", "is_active",
            "is_verified", "is_admin_verified",
            "is_banned", "ban_reason",
        ])

        for group_name in ALL_GROUPS:
            group, _ = Group.objects.get_or_create(name=group_name)
            user.groups.add(group)

        self.stdout.write(self.style.SUCCESS(
            f"User '{user.username}' ({email}) promoted to superadmin.\n"
            f"  is_staff={user.is_staff}  is_superuser={user.is_superuser}\n"
            f"  is_active={user.is_active}  is_verified={user.is_verified}\n"
            f"  Groups: {', '.join(ALL_GROUPS)}"
        ))
