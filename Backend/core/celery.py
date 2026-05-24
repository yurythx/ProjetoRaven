import os
import contextvars

from celery import Celery
from celery import signals

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("raven")

from apps.common.middleware import request_id_ctx

_celery_request_id_token: contextvars.ContextVar[contextvars.Token | None] = contextvars.ContextVar(
    "celery_request_id_token",
    default=None,
)


class RequestIdTask(app.Task):
    abstract = True

    def apply_async(self, args=None, kwargs=None, **options):
        headers = dict(options.get("headers") or {})
        if "request_id" not in headers:
            rid = request_id_ctx.get("") or ""
            if rid:
                headers["request_id"] = rid
        options["headers"] = headers
        return super().apply_async(args=args, kwargs=kwargs, **options)


app.Task = RequestIdTask
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
app.autodiscover_tasks()


@signals.task_prerun.connect
def _set_request_id_ctx(sender=None, task_id=None, task=None, **kwargs):
    rid = ""
    try:
        headers = getattr(task.request, "headers", None) or {}
        rid = headers.get("request_id") or ""
    except Exception:
        rid = ""

    if not rid:
        rid = task_id or ""

    token = request_id_ctx.set(rid)
    _celery_request_id_token.set(token)


@signals.task_postrun.connect
def _reset_request_id_ctx(sender=None, task_id=None, task=None, **kwargs):
    token = _celery_request_id_token.get(None)
    if token is None:
        request_id_ctx.set("")
        return

    try:
        request_id_ctx.reset(token)
    except Exception:
        request_id_ctx.set("")
