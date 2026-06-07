"""
WebSocket consumer for real-time forum topic updates.

URL: ws://<host>/ws/forum/topic/<slug>/

Clients subscribe to a topic and receive new replies as they are posted.
Authentication is optional — forum content is public, but the slug must be valid.

Outgoing message format:
    {"type": "new_reply", "reply": {id, content, author_name, created_at, is_solution}}
"""
import json
import re

from channels.generic.websocket import AsyncWebsocketConsumer
import logging
import asyncio

logger = logging.getLogger(__name__)

_SAFE_SLUG = re.compile(r"^[a-zA-Z0-9_-]{1,200}$")


class TopicConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.topic_slug = self.scope["url_route"]["kwargs"]["slug"]

        if not _SAFE_SLUG.match(self.topic_slug):
            await self.close(code=4004)
            return

        self.group_name = f"forum_topic_{self.topic_slug}"
        try:
            await self.accept()
            await asyncio.wait_for(
                self.channel_layer.group_add(self.group_name, self.channel_name),
                timeout=2.5,
            )
        except Exception:
            logger.warning("WS forum group_add failed", exc_info=True)
            await self.close(code=1013)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.warning("WS forum group_discard failed", exc_info=True)

    async def receive(self, text_data=None, bytes_data=None):
        pass

    async def new_reply(self, event):
        """Broadcast a new reply payload to all subscribers of this topic."""
        await self.send(text_data=json.dumps({
            "type": "new_reply",
            "reply": event["reply"],
        }))
