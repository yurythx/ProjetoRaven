from django.conf import settings
from django.core.cache import cache

_DEFAULT_MAX_FAILURES = 5
_DEFAULT_LOCKOUT_SECONDS = 900  # 15 minutes


def _max_failures() -> int:
    return getattr(settings, "ACCOUNTS_LOGIN_MAX_FAILURES", _DEFAULT_MAX_FAILURES)


def _lockout_seconds() -> int:
    return getattr(settings, "ACCOUNTS_LOGIN_LOCKOUT_SECONDS", _DEFAULT_LOCKOUT_SECONDS)


def _cache_key(identifier: str) -> str:
    return f"login_failures:{identifier.lower().strip()}"


def is_locked_out(identifier: str) -> bool:
    return (cache.get(_cache_key(identifier)) or 0) >= _max_failures()


def record_failure(identifier: str) -> int:
    key = _cache_key(identifier)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=_lockout_seconds())
        count = 1
    if count == 1:
        # Set expiry on first write (incr doesn't set timeout)
        cache.expire(key, _lockout_seconds())
    return count


def clear_failures(identifier: str) -> None:
    cache.delete(_cache_key(identifier))
