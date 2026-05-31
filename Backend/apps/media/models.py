import os
import uuid

from django.db import models
from apps.common.models import UUIDModel


def _upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"uploads/{uuid.uuid4().hex}{ext}"


class MediaFile(UUIDModel):
    image = models.ImageField(upload_to=_upload_path)
    alt_text = models.CharField(max_length=255, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="media_files",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_files"
        ordering = ["-created_at"]

    def __str__(self):
        return self.original_filename or str(self.id)
