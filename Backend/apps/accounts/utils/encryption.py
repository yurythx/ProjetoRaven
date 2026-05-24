import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

_FERNET_TOKEN_PREFIX = b"gAAAAA"


def _get_fernet() -> Fernet:
    key = getattr(settings, "TOTP_ENCRYPTION_KEY", "").strip()
    if not key:
        # Derive a consistent 32-byte key from SECRET_KEY for dev/test environments.
        # In production, set TOTP_ENCRYPTION_KEY explicitly.
        raw = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(raw).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_totp_secret(secret: str) -> str:
    if not secret:
        return ""
    return _get_fernet().encrypt(secret.encode()).decode()


def decrypt_totp_secret(token: str) -> str:
    if not token:
        return ""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        # Legacy plaintext fallback during migration window
        return token
