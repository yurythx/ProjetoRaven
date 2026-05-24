"""OAuth 2.0 Authorization Code flow for Google and Discord.

Each provider implements two operations:
  - build_auth_url(redirect_uri, state)  → URL the user visits
  - exchange_code(code, redirect_uri)    → (provider_uid, email, display_name, extra_data)
"""
import secrets
import logging
from urllib.parse import urlencode

import requests as http_requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

_GOOGLE_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO   = "https://www.googleapis.com/oauth2/v3/userinfo"

_DISCORD_AUTH_URL  = "https://discord.com/api/oauth2/authorize"
_DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
_DISCORD_USERINFO  = "https://discord.com/api/users/@me"

# ── Helpers ────────────────────────────────────────────────────────────────────

def _cfg(key: str, default: str = "") -> str:
    return getattr(settings, key, default) or default


def generate_state() -> str:
    return secrets.token_urlsafe(32)


def _provider_credentials(provider: str) -> tuple[str, str]:
    """Return (client_id, client_secret). DB settings take precedence over env vars."""
    from apps.accounts.models import OAuthProviderSettings
    from apps.accounts.emailing import decrypt_secret

    try:
        cfg = OAuthProviderSettings.objects.filter(provider=provider, is_enabled=True).first()
        if cfg and cfg.client_id and cfg.client_secret_encrypted:
            return cfg.client_id, decrypt_secret(cfg.client_secret_encrypted)
    except Exception:
        pass

    env_keys = {
        "google":  ("OAUTH_GOOGLE_CLIENT_ID",  "OAUTH_GOOGLE_CLIENT_SECRET"),
        "discord": ("OAUTH_DISCORD_CLIENT_ID", "OAUTH_DISCORD_CLIENT_SECRET"),
    }
    id_key, secret_key = env_keys.get(provider, ("", ""))
    return _cfg(id_key), _cfg(secret_key)


# ── Google ─────────────────────────────────────────────────────────────────────

def google_auth_url(redirect_uri: str, state: str) -> str:
    client_id, _ = _provider_credentials("google")
    if not client_id:
        raise ValueError("OAUTH_GOOGLE_CLIENT_ID not configured")
    params = {
        "client_id":     client_id,
        "redirect_uri":  redirect_uri,
        "response_type": "code",
        "scope":         "openid email profile",
        "state":         state,
        "access_type":   "online",
        "prompt":        "select_account",
    }
    return f"{_GOOGLE_AUTH_URL}?{urlencode(params)}"


def google_exchange_code(code: str, redirect_uri: str) -> dict:
    """Exchange authorization code for user info.

    Returns dict: {provider_uid, email, display_name, avatar_url, extra_data}
    """
    client_id, client_secret = _provider_credentials("google")

    token_res = http_requests.post(
        _GOOGLE_TOKEN_URL,
        data={
            "code":          code,
            "client_id":     client_id,
            "client_secret": client_secret,
            "redirect_uri":  redirect_uri,
            "grant_type":    "authorization_code",
        },
        timeout=10,
    )
    token_res.raise_for_status()
    tokens = token_res.json()

    user_res = http_requests.get(
        _GOOGLE_USERINFO,
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        timeout=10,
    )
    user_res.raise_for_status()
    info = user_res.json()

    return {
        "provider_uid":   info["sub"],
        "email":          info.get("email", ""),
        "display_name":   info.get("name", ""),
        "avatar_url":     info.get("picture", ""),
        "extra_data":     {"name": info.get("name"), "locale": info.get("locale"), "picture": info.get("picture")},
    }


# ── Discord ────────────────────────────────────────────────────────────────────

def discord_auth_url(redirect_uri: str, state: str) -> str:
    client_id, _ = _provider_credentials("discord")
    if not client_id:
        raise ValueError("OAUTH_DISCORD_CLIENT_ID not configured")
    params = {
        "client_id":     client_id,
        "redirect_uri":  redirect_uri,
        "response_type": "code",
        "scope":         "identify email",
        "state":         state,
        "prompt":        "consent",
    }
    return f"{_DISCORD_AUTH_URL}?{urlencode(params)}"


def discord_exchange_code(code: str, redirect_uri: str) -> dict:
    client_id, client_secret = _provider_credentials("discord")

    token_res = http_requests.post(
        _DISCORD_TOKEN_URL,
        data={
            "code":          code,
            "client_id":     client_id,
            "client_secret": client_secret,
            "redirect_uri":  redirect_uri,
            "grant_type":    "authorization_code",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    token_res.raise_for_status()
    tokens = token_res.json()

    user_res = http_requests.get(
        _DISCORD_USERINFO,
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        timeout=10,
    )
    user_res.raise_for_status()
    info = user_res.json()

    avatar_url = ""
    if info.get("avatar"):
        avatar_url = f"https://cdn.discordapp.com/avatars/{info['id']}/{info['avatar']}.png"

    return {
        "provider_uid": info["id"],
        "email":        info.get("email", ""),
        "display_name": info.get("global_name") or info.get("username", ""),
        "avatar_url":   avatar_url,
        "extra_data":   {"username": info.get("username"), "discriminator": info.get("discriminator"), "avatar": info.get("avatar")},
    }


# ── Account resolution ─────────────────────────────────────────────────────────

def get_or_create_user(provider: str, user_info: dict):
    """Return (user, created) for a given provider + user_info dict.

    Logic:
    1. If SocialAccount exists for provider+uid → return its user
    2. If email matches an existing user → link provider, return user
    3. Otherwise → create new user (auto-verified via OAuth)
    """
    from django.contrib.auth import get_user_model
    from ..models import SocialAccount

    User = get_user_model()
    provider_uid  = user_info["provider_uid"]
    email         = user_info.get("email", "")
    display_name  = user_info.get("display_name", "")
    extra_data    = user_info.get("extra_data", {})

    # 1. Existing social link
    sa = SocialAccount.objects.filter(provider=provider, provider_uid=provider_uid).select_related("user").first()
    if sa:
        sa.extra_data = extra_data
        sa.save(update_fields=["extra_data", "updated_at"])
        return sa.user, False

    # 2. Existing user by email
    user = None
    if email:
        user = User.objects.filter(email=email).first()

    # 3. Create new user
    created = False
    if not user:
        username = _unique_username(display_name or email.split("@")[0])
        user = User.objects.create_user(
            email=email,
            username=username,
            password=None,
            display_name=display_name,
            is_verified=True,
            is_active=True,
        )
        created = True
    elif not user.is_verified:
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=["is_verified", "is_active"])

    SocialAccount.objects.create(
        user=user,
        provider=provider,
        provider_uid=provider_uid,
        extra_data=extra_data,
    )

    return user, created


def _unique_username(base: str) -> str:
    from django.contrib.auth import get_user_model
    import re
    User = get_user_model()
    slug = re.sub(r"[^a-zA-Z0-9_]", "_", base)[:28] or "user"
    candidate = slug
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{slug}_{suffix}"
        suffix += 1
    return candidate
