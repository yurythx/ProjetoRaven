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
import logging
import asyncio

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        await self.accept()

        if not user or isinstance(user, AnonymousUser) or not getattr(user, "is_authenticated", False):
            await self.close(code=4003)
            return

        self.group_name = f"notifications_user_{user.id}"
        try:
            await asyncio.wait_for(
                self.channel_layer.group_add(self.group_name, self.channel_name),
                timeout=2.5,
            )
        except Exception:
            logger.warning("WS notifications group_add failed", exc_info=True)
            await self.close(code=1013)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.warning("WS notifications group_discard failed", exc_info=True)

    async def receive(self, text_data=None, bytes_data=None):
        pass  # clients are receive-only

    async def new_notification(self, event):
        """Relay a notification payload to this WebSocket client."""
        await self.send(text_data=json.dumps({
            "type": "new_notification",
            "notification": event["notification"],
        }))
