from __future__ import annotations

from http.cookies import SimpleCookie
from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication


@database_sync_to_async
def _get_user(token: str):
    auth = JWTAuthentication()
    validated = auth.get_validated_token(token)
    return auth.get_user(validated)


class JwtAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        user = scope.get("user")
        if not user or isinstance(user, AnonymousUser) or getattr(user, "is_authenticated", False) is False:
            token = None
            qs = parse_qs(scope.get("query_string", b"").decode("utf-8"))
            if "token" in qs and qs["token"]:
                token = qs["token"][0]
            if not token:
                headers = {k.lower(): v for (k, v) in (scope.get("headers") or [])}
                auth_header = headers.get(b"authorization")
                if auth_header:
                    raw = auth_header.decode("utf-8", errors="ignore").strip()
                    if raw.lower().startswith("bearer "):
                        token = raw.split(" ", 1)[1].strip() or None
            if not token:
                headers = {k.lower(): v for (k, v) in (scope.get("headers") or [])}
                cookie_header = headers.get(b"cookie")
                if cookie_header:
                    c = SimpleCookie()
                    c.load(cookie_header.decode("utf-8", errors="ignore"))
                    if "raven_access" in c:
                        token = c["raven_access"].value or None
            if token:
                try:
                    scope["user"] = await _get_user(token)
                except Exception:
                    scope["user"] = AnonymousUser()
        return await super().__call__(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(AuthMiddlewareStack(inner))
