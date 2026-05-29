import os
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver
from .models import Post


@receiver(post_delete, sender=Post)
def delete_image_on_post_delete(sender, instance, **kwargs):
    if instance.image and os.path.isfile(instance.image.path):
        os.remove(instance.image.path)


@receiver(pre_save, sender=Post)
def delete_old_image_on_update(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old_image = Post.objects.get(pk=instance.pk).image
    except Post.DoesNotExist:
        return
    if old_image and old_image != instance.image and os.path.isfile(old_image.path):
        os.remove(old_image.path)
