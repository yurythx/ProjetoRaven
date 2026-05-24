from django.conf import settings
from django.core.cache import caches
from django.db import connections
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import SMTPSettings

class AdminDiagnosticsView(APIView):
    """System-wide health diagnostics for admin dashboard."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        db_ok = True
        cache_ok = True

        try:
            connections["default"].ensure_connection()
        except Exception:
            db_ok = False

        try:
            cache = caches["default"]
            cache.set("__diag__", "1", timeout=2)
            cache_ok = cache.get("__diag__") == "1"
        except Exception:
            cache_ok = False

        smtp_cfg = SMTPSettings.objects.order_by("-updated_at").first()
        smtp_enabled = bool(smtp_cfg and smtp_cfg.is_enabled and smtp_cfg.host)
        smtp_password_set = bool(smtp_cfg and smtp_cfg.password_encrypted)

        warnings = []
        if not settings.DEBUG and not getattr(settings, "REDIS_URL", "").strip():
            warnings.append("REDIS_URL não configurado em produção.")
        if getattr(settings, "EMAIL_SETTINGS_ENCRYPTION_SALT", "") in ["change-me-email-salt", ""]:
            warnings.append("EMAIL_SETTINGS_ENCRYPTION_SALT está usando valor padrão.")
        if smtp_enabled and not (smtp_cfg and smtp_cfg.from_email):
            warnings.append("SMTP ativo sem from_email configurado.")

        return Response(
            {
                "status": "ok" if (db_ok and cache_ok) else "degraded",
                "app": {
                    "version": getattr(settings, "APP_VERSION", ""),
                    "build_sha": getattr(settings, "APP_BUILD_SHA", ""),
                    "build_time": getattr(settings, "APP_BUILD_TIME", ""),
                    "debug": bool(settings.DEBUG),
                },
                "db": {"ok": db_ok},
                "cache": {"ok": cache_ok},
                "redis": {"configured": bool(getattr(settings, "REDIS_URL", "").strip())},
                "email": {"backend": getattr(settings, "EMAIL_BACKEND", ""), "from": getattr(settings, "DEFAULT_FROM_EMAIL", "")},
                "smtp": {
                    "enabled": smtp_enabled,
                    "host": smtp_cfg.host if smtp_cfg else "",
                    "port": int(smtp_cfg.port) if smtp_cfg else None,
                    "username": smtp_cfg.username if smtp_cfg else "",
                    "use_tls": bool(smtp_cfg.use_tls) if smtp_cfg else False,
                    "password_set": smtp_password_set,
                    "from_email": smtp_cfg.from_email if smtp_cfg else "",
                },
                "otp": {
                    "email_verify_expires_minutes": int(getattr(settings, "ACCOUNTS_EMAIL_VERIFY_CODE_EXPIRES_MINUTES", 10)),
                    "password_reset_expires_minutes": int(getattr(settings, "ACCOUNTS_PASSWORD_RESET_CODE_EXPIRES_MINUTES", 10)),
                    "max_attempts": int(getattr(settings, "ACCOUNTS_OTP_MAX_ATTEMPTS", 10)),
                    "cooldown_seconds": int(getattr(settings, "ACCOUNTS_OTP_COOLDOWN_SECONDS", 60)),
                },
                "warnings": warnings,
            },
            status=status.HTTP_200_OK if (db_ok and cache_ok) else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
