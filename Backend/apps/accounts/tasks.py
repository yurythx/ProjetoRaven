import logging
from typing import Optional

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(
    self,
    *,
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
) -> None:
    try:
        from apps.accounts.emailing import send_email
        send_email(to_email=to_email, subject=subject, body=body, html_body=html_body)
    except Exception as exc:
        logger.warning("send_email_task failed (attempt %s): %s", self.request.retries + 1, exc)
        raise self.retry(exc=exc)


@shared_task
def cleanup_expired_otps() -> dict:
    from django.utils import timezone
    from datetime import timedelta
    from apps.accounts.models import EmailOneTimeCode

    cutoff = timezone.now() - timedelta(days=settings.ACCOUNTS_OTP_CLEANUP_AFTER_DAYS)
    deleted, _ = EmailOneTimeCode.objects.filter(created_at__lt=cutoff).delete()
    logger.info("cleanup_expired_otps: deleted %s records", deleted)
    return {"deleted": deleted}


