import base64
import secrets
from datetime import timedelta
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone


def _get_fernet() -> Fernet:
    salt = getattr(settings, "EMAIL_SETTINGS_ENCRYPTION_SALT", "email-settings-salt").encode("utf-8")
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=390000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.SECRET_KEY.encode("utf-8")))
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    if not value:
        return ""
    f = _get_fernet()
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    f = _get_fernet()
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def get_from_email() -> str:
    from apps.accounts.models import SMTPSettings

    cfg = SMTPSettings.objects.order_by("-updated_at").first()
    if not cfg or not cfg.from_email:
        return getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost")
    if cfg.from_name:
        return f"{cfg.from_name} <{cfg.from_email}>"
    return cfg.from_email


def _get_reply_to() -> list[str]:
    from apps.accounts.models import SMTPSettings

    cfg = SMTPSettings.objects.order_by("-updated_at").first()
    if cfg and cfg.reply_to:
        return [cfg.reply_to]
    return []


def send_email(*, to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> None:
    msg = EmailMultiAlternatives(
        subject=subject,
        body=body,
        from_email=get_from_email(),
        to=[to_email],
        reply_to=_get_reply_to() or None,
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)


def _random_6_digits() -> str:
    return f"{secrets.randbelow(1000000):06d}"


class OneTimeCodeService:
    @classmethod
    def issue(
        cls,
        *,
        user,
        purpose: str,
        expires_in_minutes: int,
        cooldown_seconds: Optional[int] = None,
        max_per_hour: Optional[int] = None,
        max_per_hour_per_ip: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> str:
        from apps.accounts.models import EmailOneTimeCode

        cooldown_seconds = cooldown_seconds if cooldown_seconds is not None else getattr(settings, "ACCOUNTS_OTP_COOLDOWN_SECONDS", 60)
        max_per_hour = max_per_hour if max_per_hour is not None else getattr(settings, "ACCOUNTS_OTP_MAX_PER_HOUR", 5)
        max_per_hour_per_ip = max_per_hour_per_ip if max_per_hour_per_ip is not None else getattr(settings, "ACCOUNTS_OTP_MAX_PER_HOUR_PER_IP", 10)

        now = timezone.now()
        latest = (
            EmailOneTimeCode.objects.filter(user=user, purpose=purpose)
            .order_by("-created_at")
            .only("created_at")
            .first()
        )
        if latest and cooldown_seconds > 0:
            delta = (now - latest.created_at).total_seconds()
            if delta < float(cooldown_seconds):
                raise ValueError("Please wait before requesting another code.")

        if max_per_hour > 0:
            window_start = now - timedelta(hours=1)
            cnt = EmailOneTimeCode.objects.filter(user=user, purpose=purpose, created_at__gte=window_start).count()
            if cnt >= int(max_per_hour):
                raise ValueError("Too many requests.")

        if ip_address and max_per_hour_per_ip > 0:
            window_start = now - timedelta(hours=1)
            cnt = EmailOneTimeCode.objects.filter(
                ip_address=ip_address,
                purpose=purpose,
                created_at__gte=window_start,
            ).count()
            if cnt >= int(max_per_hour_per_ip):
                raise ValueError("Too many requests.")

        EmailOneTimeCode.objects.filter(user=user, purpose=purpose, consumed_at__isnull=True).update(consumed_at=now)

        code = _random_6_digits()
        EmailOneTimeCode.objects.create(
            user=user,
            purpose=purpose,
            code_hash=make_password(code),
            expires_at=now + timedelta(minutes=int(expires_in_minutes)),
            ip_address=ip_address,
            user_agent=user_agent or "",
        )
        return code

    @classmethod
    def verify(
        cls,
        *,
        user,
        purpose: str,
        code: str,
        max_attempts: int,
    ) -> bool:
        from apps.accounts.models import EmailOneTimeCode

        otp = (
            EmailOneTimeCode.objects.filter(
                user=user,
                purpose=purpose,
                consumed_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .order_by("-created_at")
            .first()
        )
        if not otp:
            return False
        if otp.attempts >= int(max_attempts):
            return False

        ok = check_password(code, otp.code_hash)
        if ok:
            otp.consumed_at = timezone.now()
            otp.save(update_fields=["consumed_at"])
            return True

        otp.attempts = otp.attempts + 1
        otp.save(update_fields=["attempts"])
        return False
