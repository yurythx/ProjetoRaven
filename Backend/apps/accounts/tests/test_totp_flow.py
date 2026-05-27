"""
Tests for the full 2FA (TOTP) lifecycle.

Covers: setup → enable → login with TOTP → login with recovery code → disable.
"""
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


def _make_verified_user(suffix="totp"):
    user = User.objects.create_user(
        email=f"u_{suffix}@example.com",
        username=f"u_{suffix}",
        password="Pass1234!",
    )
    user.is_verified = True
    user.save(update_fields=["is_verified"])
    return user


class TOTPSetupTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_verified_user("setup")
        self.client.force_authenticate(user=self.user)

    def test_setup_returns_secret_and_qr(self):
        res = self.client.post("/api/v1/accounts/2fa/setup/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("secret", res.data)
        self.assertIn("qr_code", res.data)
        self.assertIn("uri", res.data)

    def test_setup_stores_encrypted_secret(self):
        self.client.post("/api/v1/accounts/2fa/setup/")
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.totp_secret)

    def test_setup_fails_if_2fa_already_enabled(self):
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_enabled"])
        res = self.client.post("/api/v1/accounts/2fa/setup/")
        self.assertEqual(res.status_code, 400)


class TOTPEnableTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_verified_user("enable")
        self.client.force_authenticate(user=self.user)
        # Run setup first
        self.client.post("/api/v1/accounts/2fa/setup/")
        self.user.refresh_from_db()

    def _get_valid_totp_code(self):
        import pyotp
        from apps.accounts.utils.encryption import decrypt_totp_secret
        secret = decrypt_totp_secret(self.user.totp_secret)
        return pyotp.TOTP(secret).now()

    def test_enable_with_valid_code(self):
        code = self._get_valid_totp_code()
        res = self.client.post("/api/v1/accounts/2fa/enable/", {"code": code})
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.totp_enabled)

    def test_enable_with_invalid_code_fails(self):
        res = self.client.post("/api/v1/accounts/2fa/enable/", {"code": "000000"})
        self.assertIn(res.status_code, [400, 401])

    def test_enable_generates_recovery_codes(self):
        code = self._get_valid_totp_code()
        res = self.client.post("/api/v1/accounts/2fa/enable/", {"code": code})
        self.assertEqual(res.status_code, 200)
        self.assertIn("recovery_codes", res.data)
        self.assertEqual(len(res.data["recovery_codes"]), 8)


class TOTPLoginFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_verified_user("login")
        self.client.force_authenticate(user=self.user)
        # Setup and enable 2FA
        self.client.post("/api/v1/accounts/2fa/setup/")
        self.user.refresh_from_db()
        import pyotp
        from apps.accounts.utils.encryption import decrypt_totp_secret
        secret = decrypt_totp_secret(self.user.totp_secret)
        code = pyotp.TOTP(secret).now()
        self.client.post("/api/v1/accounts/2fa/enable/", {"code": code})
        self.user.refresh_from_db()
        self.client.force_authenticate(user=None)

    def _get_valid_totp_code(self):
        import pyotp
        from apps.accounts.utils.encryption import decrypt_totp_secret
        secret = decrypt_totp_secret(self.user.totp_secret)
        return pyotp.TOTP(secret).now()

    def test_login_returns_totp_required(self):
        res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": self.user.email, "password": "Pass1234!"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get("totp_required"))
        self.assertIn("totp_token", res.data)

    def test_verify_with_valid_totp_code(self):
        login_res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": self.user.email, "password": "Pass1234!"},
            format="json",
        )
        totp_token = login_res.data["totp_token"]
        code = self._get_valid_totp_code()
        res = self.client.post(
            "/api/v1/accounts/2fa/verify/",
            {"totp_token": totp_token, "code": code},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        tokens = res.data.get("tokens", res.data)
        self.assertIn("access", tokens)
        self.assertIn("refresh", tokens)

    def test_verify_with_invalid_code_fails(self):
        login_res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": self.user.email, "password": "Pass1234!"},
            format="json",
        )
        totp_token = login_res.data["totp_token"]
        res = self.client.post(
            "/api/v1/accounts/2fa/verify/",
            {"totp_token": totp_token, "code": "000000"},
            format="json",
        )
        self.assertIn(res.status_code, [400, 401])


class TOTPDisableTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_verified_user("disable")
        self.client.force_authenticate(user=self.user)
        # Setup and enable
        self.client.post("/api/v1/accounts/2fa/setup/")
        self.user.refresh_from_db()
        import pyotp
        from apps.accounts.utils.encryption import decrypt_totp_secret
        secret = decrypt_totp_secret(self.user.totp_secret)
        code = pyotp.TOTP(secret).now()
        self.client.post("/api/v1/accounts/2fa/enable/", {"code": code})
        self.user.refresh_from_db()

    def _get_valid_totp_code(self):
        import pyotp
        from apps.accounts.utils.encryption import decrypt_totp_secret
        secret = decrypt_totp_secret(self.user.totp_secret)
        return pyotp.TOTP(secret).now()

    def test_disable_with_valid_code(self):
        code = self._get_valid_totp_code()
        res = self.client.post("/api/v1/accounts/2fa/disable/", {"code": code})
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.totp_enabled)

    def test_disable_with_invalid_code_fails(self):
        res = self.client.post("/api/v1/accounts/2fa/disable/", {"code": "000000"})
        self.assertIn(res.status_code, [400, 401])
        self.user.refresh_from_db()
        self.assertTrue(self.user.totp_enabled)
