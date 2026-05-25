from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "verb", "actor_name", "message", "target_url", "read", "created_at"]
        read_only_fields = ["id", "verb", "actor_name", "message", "target_url", "created_at"]
