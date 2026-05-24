import logging
from django.db.models import Q
from django.contrib.auth import get_user_model
from ..models import Friendship

User = get_user_model()

class SocialService:
    @staticmethod
    def send_ws_notification(user_id, notification_type, data):
        """Dispatch a real-time notification via Channels."""
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"user_{user_id}",
                    {"type": "notification.new", "notification_type": notification_type, "data": data},
                )
        except Exception as e:
            logging.getLogger(__name__).error(f"Failed to send WS notification: {e}")

    @classmethod
    def list_friendships(cls, user):
        return Friendship.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        ).select_related("from_user", "to_user")

    @classmethod
    def send_friend_request(cls, from_user, to_user_id):
        if str(to_user_id) == str(from_user.id):
            raise ValueError("Cannot friend yourself")

        friendship, created = Friendship.objects.get_or_create(
            from_user=from_user,
            to_user_id=to_user_id,
            defaults={"status": "pending"},
        )
        if not created:
            raise ValueError("Request already exists")

        cls.send_ws_notification(
            to_user_id,
            "friend_request",
            {"from_user": from_user.display_name or from_user.username, "friendship_id": str(friendship.id)},
        )
        return friendship

    @classmethod
    def handle_friendship_action(cls, user, friendship_id, action):
        if action not in ["accept", "reject", "block"]:
            raise ValueError("Invalid action")

        try:
            if action == "accept":
                friendship = Friendship.objects.get(id=friendship_id, to_user=user, status="pending")
                friendship.status = "accepted"
                friendship.save()
                cls.send_ws_notification(
                    friendship.from_user_id,
                    "friend_accepted",
                    {"user": user.display_name or user.username},
                )
                return friendship
            elif action == "reject":
                friendship = Friendship.objects.get(id=friendship_id, to_user=user, status="pending")
                friendship.delete()
                return None
            elif action == "block":
                friendship = Friendship.objects.get(
                    Q(id=friendship_id) & (Q(from_user=user) | Q(to_user=user))
                )
                friendship.status = "blocked"
                friendship.save()
                return friendship
        except Friendship.DoesNotExist:
            raise ValueError("Friendship not found or unauthorized")

    @classmethod
    def remove_friendship(cls, user, friendship_id):
        try:
            friendship = Friendship.objects.get(
                Q(id=friendship_id) & (Q(from_user=user) | Q(to_user=user))
            )
            friendship.delete()
        except Friendship.DoesNotExist:
            raise ValueError("Friendship not found")
