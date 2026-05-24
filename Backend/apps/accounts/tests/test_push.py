"""Tests for Web Push notification endpoints and send_push_to_user helper."""
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import PushSubscription, User
from apps.accounts.services.push import send_push_to_user


def make_user(suffix="push"):
    return User.objects.create_user(
        email=f"u_{suffix}@example.com",
        username=f"u_{suffix}",
        password="TestPass123!",
    )


VAPID_SETTINGS = {
    "VAPID_PRIVATE_KEY": "test-private-key",
    "VAPID_PUBLIC_KEY": "test-public-key",
    "VAPID_ADMIN_EMAIL": "admin@example.com",
}

SUBSCRIBE_PAYLOAD = {
    "endpoint": "https://push.example.com/sub/abc123",
    "keys": {"p256dh": "key_p256dh_value", "auth": "auth_value"},
}


class VapidPublicKeyViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(**VAPID_SETTINGS)
    def test_returns_public_key(self):
        res = self.client.get("/api/v1/accounts/push/vapid-public-key/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["public_key"], "test-public-key")

    @override_settings(VAPID_PUBLIC_KEY="")
    def test_returns_503_when_not_configured(self):
        res = self.client.get("/api/v1/accounts/push/vapid-public-key/")
        self.assertEqual(res.status_code, 503)

    @override_settings(**VAPID_SETTINGS)
    def test_no_auth_required(self):
        res = self.client.get("/api/v1/accounts/push/vapid-public-key/")
        self.assertNotEqual(res.status_code, 401)


class PushSubscribeViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user("sub")

    def test_unauthenticated_post_returns_401(self):
        res = self.client.post("/api/v1/accounts/push/subscribe/", SUBSCRIBE_PAYLOAD, format="json")
        self.assertEqual(res.status_code, 401)

    def test_unauthenticated_delete_returns_401(self):
        res = self.client.delete("/api/v1/accounts/push/subscribe/",
                                 {"endpoint": "https://push.example.com/sub/abc123"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_post_creates_subscription(self):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/v1/accounts/push/subscribe/", SUBSCRIBE_PAYLOAD, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(
            PushSubscription.objects.filter(
                user=self.user, endpoint=SUBSCRIBE_PAYLOAD["endpoint"]
            ).exists()
        )

    def test_post_missing_keys_returns_400(self):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/v1/accounts/push/subscribe/",
                               {"endpoint": "https://push.example.com/sub/x"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_post_empty_endpoint_returns_400(self):
        self.client.force_authenticate(self.user)
        payload = {"endpoint": "", "keys": {"p256dh": "k", "auth": "a"}}
        res = self.client.post("/api/v1/accounts/push/subscribe/", payload, format="json")
        self.assertEqual(res.status_code, 400)

    def test_post_is_idempotent(self):
        self.client.force_authenticate(self.user)
        self.client.post("/api/v1/accounts/push/subscribe/", SUBSCRIBE_PAYLOAD, format="json")
        self.client.post("/api/v1/accounts/push/subscribe/", SUBSCRIBE_PAYLOAD, format="json")
        count = PushSubscription.objects.filter(endpoint=SUBSCRIBE_PAYLOAD["endpoint"]).count()
        self.assertEqual(count, 1)

    def test_delete_removes_subscription(self):
        self.client.force_authenticate(self.user)
        PushSubscription.objects.create(
            user=self.user,
            endpoint="https://push.example.com/sub/del",
            p256dh="key",
            auth="auth",
        )
        res = self.client.delete(
            "/api/v1/accounts/push/subscribe/",
            {"endpoint": "https://push.example.com/sub/del"},
            format="json",
        )
        self.assertEqual(res.status_code, 204)
        self.assertFalse(
            PushSubscription.objects.filter(endpoint="https://push.example.com/sub/del").exists()
        )

    def test_delete_missing_endpoint_returns_400(self):
        self.client.force_authenticate(self.user)
        res = self.client.delete("/api/v1/accounts/push/subscribe/", {}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_delete_only_removes_own_subscription(self):
        other = make_user("other")
        other_sub = PushSubscription.objects.create(
            user=other,
            endpoint="https://push.example.com/sub/other",
            p256dh="key",
            auth="auth",
        )
        self.client.force_authenticate(self.user)
        self.client.delete(
            "/api/v1/accounts/push/subscribe/",
            {"endpoint": "https://push.example.com/sub/other"},
            format="json",
        )
        self.assertTrue(PushSubscription.objects.filter(id=other_sub.id).exists())


class SendPushToUserTest(TestCase):
    def setUp(self):
        self.user = make_user("snd")

    @override_settings(**VAPID_SETTINGS)
    @patch("apps.accounts.services.push.send_push")
    def test_sends_to_all_subscriptions(self, mock_send):
        mock_send.return_value = True
        for i in range(3):
            PushSubscription.objects.create(
                user=self.user,
                endpoint=f"https://push.example.com/sub/{i}",
                p256dh=f"key{i}",
                auth=f"auth{i}",
            )
        count = send_push_to_user(self.user, title="Test", body="Body", url="/play")
        self.assertEqual(count, 3)
        self.assertEqual(mock_send.call_count, 3)

    @override_settings(**VAPID_SETTINGS)
    @patch("apps.accounts.services.push.send_push")
    def test_deletes_stale_subscriptions_on_failure(self, mock_send):
        mock_send.return_value = False
        stale = PushSubscription.objects.create(
            user=self.user,
            endpoint="https://push.example.com/stale",
            p256dh="key",
            auth="auth",
        )
        send_push_to_user(self.user, title="T", body="B")
        self.assertFalse(PushSubscription.objects.filter(id=stale.id).exists())

    @override_settings(**VAPID_SETTINGS)
    @patch("apps.accounts.services.push.send_push")
    def test_returns_zero_when_no_subscriptions(self, mock_send):
        count = send_push_to_user(self.user, title="T", body="B")
        self.assertEqual(count, 0)
        mock_send.assert_not_called()

    @override_settings(**VAPID_SETTINGS)
    @patch("apps.accounts.services.push.send_push")
    def test_keeps_successful_subscriptions(self, mock_send):
        mock_send.return_value = True
        sub = PushSubscription.objects.create(
            user=self.user,
            endpoint="https://push.example.com/good",
            p256dh="key",
            auth="auth",
        )
        send_push_to_user(self.user, title="T", body="B")
        self.assertTrue(PushSubscription.objects.filter(id=sub.id).exists())
