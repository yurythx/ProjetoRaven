import sys
from typing import Optional

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend
from django.core.mail import get_connection

from apps.accounts.emailing import decrypt_secret


class DatabaseEmailBackend(BaseEmailBackend):
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_tls: Optional[bool] = None,
        fail_silently: bool = False,
        use_ssl: Optional[bool] = None,
        timeout: Optional[int] = None,
        ssl_keyfile=None,
        ssl_certfile=None,
        **kwargs,
    ):
        super().__init__(fail_silently=fail_silently)
        self._backend = None

    def _get_backend(self):
        if self._backend is not None:
            return self._backend

        from apps.accounts.models import SMTPSettings

        cfg = SMTPSettings.objects.order_by("-updated_at").first()
        if cfg and cfg.is_enabled and cfg.host:
            self._backend = SMTPEmailBackend(
                host=cfg.host,
                port=int(cfg.port),
                username=cfg.username or None,
                password=decrypt_secret(cfg.password_encrypted) or None,
                use_tls=bool(cfg.use_tls),
                use_ssl=bool(cfg.use_ssl),
                timeout=int(cfg.timeout or 10),
                fail_silently=self.fail_silently,
            )
            return self._backend

        fallback = getattr(settings, "ACCOUNTS_FALLBACK_EMAIL_BACKEND", "")
        if "test" in sys.argv and not fallback:
            fallback = "django.core.mail.backends.locmem.EmailBackend"
        if fallback:
            self._backend = get_connection(fallback, fail_silently=self.fail_silently)
            return self._backend

        self._backend = SMTPEmailBackend(fail_silently=self.fail_silently)
        return self._backend

    def open(self):
        return self._get_backend().open()

    def close(self):
        return self._get_backend().close()

    def send_messages(self, email_messages):
        return self._get_backend().send_messages(email_messages)

