from django.db.models.signals import post_migrate
from django.dispatch import receiver


@receiver(post_migrate)
def create_default_groups(sender, **kwargs):
    if sender.name == "accounts":
        from apps.accounts.permission_initialier import PermissionInitializer
        PermissionInitializer.create_groups_and_permissions()
