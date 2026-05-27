"""
WebSocket consumer for real-time in-app notifications.

URL: ws://<host>/ws/notifications/

Only authenticated users may connect. Each user joins their own private
channel group `notifications_user_<uuid>`. When a Notification is saved,
`signals.py` broadcasts a `new_notification` event to that group.

Outgoing message format:
    {"type": "new_notification", "notification": {id, verb, actor_name,
                                                   message, target_url,
                                                   read, created_at}}
"""
import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser) or not getattr(user, "is_authenticated", False):
            await self.close(code=4003)
            return

        self.group_name = f"notifications_user_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass  # clients are receive-only

    async def new_notification(self, event):
        """Relay a notification payload to this WebSocket client."""
        await self.send(text_data=json.dumps({
            "type": "new_notification",
            "notification": event["notification"],
        }))
