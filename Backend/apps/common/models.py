"""
UUIDModel - Abstract Base Class for all models in the project.
All tables must use UUID as Primary Key.
"""
import uuid

from django.db import models


class UUIDModel(models.Model):
    """
    Abstract base class that provides a UUID primary key.
    All models in the project should inherit from this class.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

    def __str__(self):
        return str(self.id)
