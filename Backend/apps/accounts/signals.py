import os
from django.db.models.signals import post_delete, post_migrate, pre_save
from django.dispatch import receiver


@receiver(post_migrate)
def create_default_groups(sender, **kwargs):
    if sender.name == "accounts":
        from apps.accounts.permission_initialier import PermissionInitializer
        PermissionInitializer.create_groups_and_permissions()


@receiver(post_delete, sender="accounts.User")
def delete_avatar_on_user_delete(sender, instance, **kwargs):
    if instance.avatar and os.path.isfile(instance.avatar.path):
        os.remove(instance.avatar.path)


@receiver(pre_save, sender="accounts.User")
def delete_old_avatar_on_update(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old_avatar = sender.objects.get(pk=instance.pk).avatar
    except sender.DoesNotExist:
        return
    if old_avatar and old_avatar != instance.avatar and os.path.isfile(old_avatar.path):
        os.remove(old_avatar.path)
