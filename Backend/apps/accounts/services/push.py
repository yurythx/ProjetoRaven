"""Web Push notification service using VAPID (pywebpush)."""

import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def _get_vapid_claims():
    return {"sub": f"mailto:{getattr(settings, 'VAPID_ADMIN_EMAIL', 'admin@example.com')}"}


def send_push(subscription, title: str, body: str, url: str = "/", icon: str = "/icon.png") -> bool:
    """Send a single Web Push notification to one subscription.

    Returns True on success, False if the subscription is gone (410/404) or on error.
    Callers should delete the subscription when this returns False due to a 410.
    """
    private_key = getattr(settings, "VAPID_PRIVATE_KEY", "")
    if not private_key:
        logger.debug("VAPID_PRIVATE_KEY not configured — push skipped")
        return False

    try:
        from pywebpush import webpush, WebPushException

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "icon": icon,
        })

        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=payload,
            vapid_private_key=private_key,
            vapid_claims=_get_vapid_claims(),
        )
        return True
    except Exception as exc:
        # pywebpush raises WebPushException; check status code for gone endpoints
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            return False
        logger.warning("push_failed endpoint=%s error=%s", subscription.endpoint[:40], exc)
        return False


def send_push_to_user(user, title: str, body: str, url: str = "/", icon: str = "/icon.png") -> int:
    """Send a push notification to all of a user's active subscriptions.

    Automatically deletes stale (410) subscriptions.
    Returns the number of successful sends.
    """
    from apps.accounts.models import PushSubscription

    sent = 0
    stale = []

    for sub in PushSubscription.objects.filter(user=user):
        ok = send_push(sub, title=title, body=body, url=url, icon=icon)
        if ok:
            sent += 1
        else:
            stale.append(sub.id)

    if stale:
        PushSubscription.objects.filter(id__in=stale).delete()

    return sent
