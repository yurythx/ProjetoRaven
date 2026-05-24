from django.conf import settings as dj_settings
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsSuperUser


_PROVIDERS = ["google", "discord"]
_ENV_KEYS = {
    "google":  ("OAUTH_GOOGLE_CLIENT_ID",  "OAUTH_GOOGLE_CLIENT_SECRET"),
    "discord": ("OAUTH_DISCORD_CLIENT_ID", "OAUTH_DISCORD_CLIENT_SECRET"),
}
_REDIRECT_PATHS = {
    "google":  "/api/auth/oauth/google/callback",
    "discord": "/api/auth/oauth/discord/callback",
}


class OAuthProviderSettingsView(APIView):
    """OAuth provider credentials management (DB takes precedence over env vars)."""

    permission_classes = [IsSuperUser]

    def get(self, request):
        from ..models import OAuthProviderSettings, SocialAccount

        result = []
        for provider in _PROVIDERS:
            cfg = OAuthProviderSettings.objects.filter(provider=provider).first()
            id_key, secret_key = _ENV_KEYS[provider]
            env_id = getattr(dj_settings, id_key, "") or ""
            env_secret = getattr(dj_settings, secret_key, "") or ""
            connected = SocialAccount.objects.filter(provider=provider).count()

            result.append({
                "provider": provider,
                "is_enabled": cfg.is_enabled if cfg else False,
                "client_id": cfg.client_id if cfg else "",
                "client_secret_set": bool(cfg and cfg.client_secret_encrypted),
                "env_configured": bool(env_id and env_secret),
                "connected_accounts": connected,
                "redirect_path": _REDIRECT_PATHS[provider],
            })

        return Response(result)

    def put(self, request, provider):
        from ..models import OAuthProviderSettings
        from ..emailing import encrypt_secret

        if provider not in _PROVIDERS:
            return Response({"error": "Unknown provider"}, status=status.HTTP_404_NOT_FOUND)

        cfg, _ = OAuthProviderSettings.objects.get_or_create(provider=provider)

        is_enabled = request.data.get("is_enabled")
        client_id = str(request.data.get("client_id", "") or "").strip()
        client_secret = str(request.data.get("client_secret", "") or "").strip()

        if is_enabled is not None:
            cfg.is_enabled = bool(is_enabled)
        if client_id:
            cfg.client_id = client_id
        if client_secret:
            cfg.client_secret_encrypted = encrypt_secret(client_secret)

        cfg.save()

        return Response({
            "provider": provider,
            "is_enabled": cfg.is_enabled,
            "client_id": cfg.client_id,
            "client_secret_set": bool(cfg.client_secret_encrypted),
        })
