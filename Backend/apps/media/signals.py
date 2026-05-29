import os
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver
from .models import MediaFile

@receiver(post_delete, sender=MediaFile)
def delete_file_on_instance_delete(sender, instance, **kwargs):
    """
    Deleta o arquivo físico do disco quando o registro no banco é removido.
    """
    if instance.image:
        if os.path.isfile(instance.image.path):
            os.remove(instance.image.path)

@receiver(pre_save, sender=MediaFile)
def delete_old_file_on_update(sender, instance, **kwargs):
    """
    Deleta o arquivo antigo do disco quando uma imagem é atualizada.
    """
    if not instance.pk:
        return False

    try:
        old_file = MediaFile.objects.get(pk=instance.pk).image
    except MediaFile.DoesNotExist:
        return False

    new_file = instance.image
    if not old_file == new_file:
        if old_file and os.path.isfile(old_file.path):
            os.remove(old_file.path)
