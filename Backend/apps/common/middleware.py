import logging
import uuid
import time
import contextvars
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


class RequestLoggingMiddleware(MiddlewareMixin):
    """Middleware para logging estruturado com request_id.
    
    Adiciona request_id a cada requisição e loga no formato JSON.
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        self.logger = logging.getLogger("django.request.structured")
        self.logger.setLevel(logging.INFO)

    def process_request(self, request):
        upstream_id = (request.META.get("HTTP_X_REQUEST_ID") or "").strip()
        request_id = upstream_id or str(uuid.uuid4())[:12]
        request.request_id = request_id
        request._request_id_token = request_id_ctx.set(request_id)

        request._request_logging_started_at = time.time()

        if getattr(settings, "SENTRY_DSN", ""):
            try:
                import sentry_sdk
                sentry_sdk.set_tag("request_id", request_id)
            except Exception:
                pass

    def process_response(self, request, response):
        started_at = getattr(request, "_request_logging_started_at", None)
        if started_at is None:
            started_at = time.time()

        duration_ms = (time.time() - started_at) * 1000

        request_id = getattr(request, "request_id", str(uuid.uuid4())[:8])

        if getattr(settings, "METRICS_ENABLED", False):
            try:
                from apps.common.metrics import observe_http_request

                match = getattr(request, "resolver_match", None)
                endpoint = (
                    getattr(match, "view_name", None)
                    or getattr(match, "route", None)
                    or request.path
                )

                observe_http_request(
                    method=request.method,
                    endpoint=str(endpoint),
                    status_code=response.status_code,
                    duration_seconds=duration_ms / 1000.0,
                )
            except Exception:
                pass

        log_data = {
            "method": request.method,
            "path": request.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "user": str(request.user.id) if request.user.is_authenticated else "anonymous",
            "ip": self._get_client_ip(request),
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:100],
        }
        
        if hasattr(request, "_extra_log_data"):
            log_data.update(request._extra_log_data)
        
        log_level = logging.INFO if response.status_code < 400 else logging.WARNING
        if response.status_code >= 500:
            log_level = logging.ERROR
        
        self.logger.log(log_level, "request", extra=log_data)
        
        if getattr(settings, "SENTRY_DSN", ""):
            try:
                import sentry_sdk
                user = getattr(request, "user", None)
                if user and user.is_authenticated:
                    sentry_sdk.set_user({
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                        "ip_address": self._get_client_ip(request),
                    })
                else:
                    sentry_sdk.set_user(None)
            except Exception:
                pass

        response["X-Request-Id"] = request_id

        token = getattr(request, "_request_id_token", None)
        if token is not None:
            try:
                request_id_ctx.reset(token)
            except Exception:
                request_id_ctx.set("")
        
        return response
    
    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        rid = request_id_ctx.get("")
        if not rid:
            rid = getattr(record, "task_id", "") or getattr(record, "task", "") or "-"
        setattr(record, "request_id", rid)
        return True


class StructuredLogger:
    """Logger estruturado para uso em services.
    
    Uso:
        logger = StructuredLogger(__name__)
        logger.info("user_login", user_id=user.id, email=user.email)
        logger.error("payment_failed", order_id=order.id, amount=amount)
    """
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def _log(self, level: int, event: str, **kwargs):
        safe = {k: (v if isinstance(v, (str, int, float, bool, type(None))) else str(v)) for k, v in kwargs.items()}
        self.logger.log(level, event, extra=safe)
    
    def debug(self, event: str, **kwargs):
        self._log(logging.DEBUG, event, **kwargs)
    
    def info(self, event: str, **kwargs):
        self._log(logging.INFO, event, **kwargs)
    
    def warning(self, event: str, **kwargs):
        self._log(logging.WARNING, event, **kwargs)
    
    def error(self, event: str, **kwargs):
        self._log(logging.ERROR, event, **kwargs)
    
    def critical(self, event: str, **kwargs):
        self._log(logging.CRITICAL, event, **kwargs)


def get_logger(name: str) -> StructuredLogger:
    """Factory para criar loggers estruturados."""
    return StructuredLogger(name)


class AdminIPRestrictionMiddleware:
    """Restringe acesso ao /admin/ e /api/schema/ por IP.

    Ativo apenas quando ADMIN_ALLOWED_IPS está preenchido no settings.
    Se vazio, não bloqueia nada (comportamento padrão).
    """

    _PROTECTED = ("/admin/", "/api/schema/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        allowed = getattr(settings, "ADMIN_ALLOWED_IPS", [])
        if allowed:
            for prefix in self._PROTECTED:
                if request.path.startswith(prefix):
                    if self._get_ip(request) not in allowed:
                        from django.http import HttpResponseForbidden
                        return HttpResponseForbidden("Access restricted.")
                    break
        return self.get_response(request)

    def _get_ip(self, request) -> str:
        xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
