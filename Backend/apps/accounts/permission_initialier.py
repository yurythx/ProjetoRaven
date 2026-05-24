from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.db import transaction


class PermissionInitializer:
    """Initialize default groups and permissions."""

    GROUPS = {
        "players": [
            "can_play",
            "can_trade",
        ],
        "blog_editors": [
            "can_create_post",
            "can_edit_own_post",
            "can_publish_post",
        ],
        "forum_moderators": [
            "can_moderate_posts",
            "can_ban_users",
            "can_pin_topics",
            "can_delete_topics",
        ],
        "admins": [],  # Gets all permissions
    }

    @classmethod
    @transaction.atomic
    def create_groups_and_permissions(cls):
        content_type = ContentType.objects.get_for_model(Group)

        for group_name, permission_codenames in cls.GROUPS.items():
            group, created = Group.objects.get_or_create(name=group_name)

            if permission_codenames:
                for codename in permission_codenames:
                    permission, _ = Permission.objects.get_or_create(
                        codename=codename,
                        name=codename.replace("_", " ").replace("-", " ").title(),
                        content_type=content_type,
                    )
                    group.permissions.add(permission)

        if Group.objects.filter(name="admins").exists():
            admin_group = Group.objects.get(name="admins")
            all_permissions = Permission.objects.all()
            admin_group.permissions.set(all_permissions)
