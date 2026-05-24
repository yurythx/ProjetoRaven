import re

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AdminAuditEvent, User


class EmailVerificationAndPasswordResetTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()  # reset throttle counters between test runs

    def _extract_code(self, body: str) -> str:
        m = re.search(r"\b(\d{6})\b", body or "")
        self.assertIsNotNone(m)
        return str(m.group(1))

    def test_register_sends_code_and_verify_activates_user(self):
        res = self.client.post(
            "/api/v1/accounts/register/",
            {
                "email": "new@example.com",
                "username": "newuser",
                "password": "Pass1234!",
                "password_confirm": "Pass1234!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json().get("verification_required"), True)

        user = User.objects.get(email="new@example.com")
        self.assertFalse(user.is_verified)
        self.assertFalse(user.is_active)

        self.assertEqual(len(mail.outbox), 1)
        code = self._extract_code(mail.outbox[0].body)
        self.assertTrue(AdminAuditEvent.objects.filter(action="email_verify_sent", target=user).exists())

        res2 = self.client.post(
            "/api/v1/accounts/email/verify/",
            {"email": "new@example.com", "code": code},
            format="json",
        )
        self.assertEqual(res2.status_code, 200)
        payload = res2.json()
        self.assertIn("tokens", payload)

        user.refresh_from_db()
        self.assertTrue(user.is_verified)
        self.assertTrue(user.is_active)
        self.assertTrue(AdminAuditEvent.objects.filter(action="email_verified", target=user).exists())

    def test_password_reset_flow_uses_code(self):
        user = User.objects.create_user(email="u@example.com", username="u", password="OldPass123!")
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=["is_verified", "is_active"])

        mail.outbox = []
        res = self.client.post("/api/v1/accounts/password-reset/", {"email": "u@example.com"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        code = self._extract_code(mail.outbox[0].body)
        self.assertTrue(AdminAuditEvent.objects.filter(action="password_reset_sent", target=user).exists())

        res2 = self.client.post(
            "/api/v1/accounts/password-reset/confirm/",
            {
                "email": "u@example.com",
                "code": code,
                "new_password": "NewPass123!",
                "new_password_confirm": "NewPass123!",
            },
            format="json",
        )
        self.assertEqual(res2.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewPass123!"))
        self.assertTrue(AdminAuditEvent.objects.filter(action="password_reset_confirmed", target=user).exists())

    def test_password_reset_rate_limit_by_ip(self):
        user = User.objects.create_user(email="ip@example.com", username="ip", password="OldPass123!")
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=["is_verified", "is_active"])

        from django.test.utils import override_settings

        with override_settings(ACCOUNTS_OTP_COOLDOWN_SECONDS=0, ACCOUNTS_OTP_MAX_PER_HOUR_PER_IP=2, ACCOUNTS_OTP_MAX_PER_HOUR=999):
            mail.outbox = []
            r1 = self.client.post("/api/v1/accounts/password-reset/", {"email": "ip@example.com"}, format="json", HTTP_X_FORWARDED_FOR="203.0.113.99")
            self.assertEqual(r1.status_code, 200)
            r2 = self.client.post("/api/v1/accounts/password-reset/", {"email": "ip@example.com"}, format="json", HTTP_X_FORWARDED_FOR="203.0.113.99")
            self.assertEqual(r2.status_code, 200)
            r3 = self.client.post("/api/v1/accounts/password-reset/", {"email": "ip@example.com"}, format="json", HTTP_X_FORWARDED_FOR="203.0.113.99")
            self.assertEqual(r3.status_code, 200)
            self.assertEqual(len(mail.outbox), 2)
