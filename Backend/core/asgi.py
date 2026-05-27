"""
ASGI config for Projeto Raven project.

Handles both HTTP (via Django) and WebSocket (via Django Channels).
"""
import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

django_asgi_app = get_asgi_application()

from apps.forum.routing import websocket_urlpatterns as forum_ws_patterns  # noqa: E402
from apps.notifications.routing import websocket_urlpatterns as notifications_ws_patterns  # noqa: E402
from core.websocket_auth import JwtAuthMiddlewareStack  # noqa: E402

all_ws_patterns = forum_ws_patterns + notifications_ws_patterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JwtAuthMiddlewareStack(URLRouter(all_ws_patterns))
        ),
    }
)
