"""
Tests for profile-related views:
  - PublicProfileView  GET  /api/v1/accounts/public/<username>/
  - ProfileView        PUT  /api/v1/accounts/profile/
  - ChangePasswordView POST /api/v1/accounts/change-password/
  - ResendEmailVerificationView POST /api/v1/accounts/email/verify/resend/
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


def make_user(username="hero", email=None, password="Pass1234!", verified=True, **kwargs):
    email = email or f"{username}@example.com"
    user = User.objects.create_user(
        email=email, username=username, password=password, **kwargs
    )
    if verified:
        user.is_verified = True
        user.save(update_fields=["is_verified"])
    return user


# ── PublicProfileView ──────────────────────────────────────────────────────────

class PublicProfileViewTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(username="publicuser", display_name="Public Hero")

    def test_returns_public_profile(self):
        res = self.client.get("/api/v1/accounts/public/publicuser/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["username"], "publicuser")
        self.assertEqual(data["display_name"], "Public Hero")
        self.assertIn("stats", data)
        self.assertIn("forum_topics", data["stats"])
        self.assertIn("forum_replies", data["stats"])
        self.assertIn("blog_posts", data["stats"])
        self.assertIn("recent_topics", data)
        self.assertIn("recent_posts", data)
        self.assertIn("is_verified", data)
        self.assertNotIn("email", data)
        self.assertNotIn("password", data)

    def test_404_for_unknown_username(self):
        res = self.client.get("/api/v1/accounts/public/doesnotexist/")
        self.assertEqual(res.status_code, 404)

    def test_404_for_inactive_user(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        res = self.client.get("/api/v1/accounts/public/publicuser/")
        self.assertEqual(res.status_code, 404)

    def test_no_auth_required(self):
        # Unauthenticated client should still get 200
        anon_client = APIClient()
        res = anon_client.get("/api/v1/accounts/public/publicuser/")
        self.assertEqual(res.status_code, 200)


# ── ProfileView (PUT) ──────────────────────────────────────────────────────────

class ProfileUpdateViewTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(username="editable", display_name="Old Name")
        self.client.force_authenticate(user=self.user)

    def test_update_display_name(self):
        res = self.client.put(
            "/api/v1/accounts/profile/",
            {"display_name": "New Hero Name"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_name, "New Hero Name")

    def test_partial_update_preserves_other_fields(self):
        self.user.birth_date = "1990-01-01"
        self.user.save(update_fields=["birth_date"])
        res = self.client.put(
            "/api/v1/accounts/profile/",
            {"display_name": "Changed"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.birth_date)

    def test_requires_authentication(self):
        anon = APIClient()
        res = anon.put("/api/v1/accounts/profile/", {"display_name": "X"}, format="json")
        self.assertEqual(res.status_code, 401)


# ── ChangePasswordView ─────────────────────────────────────────────────────────

class ChangePasswordViewTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(username="pwduser", password="OldPass123!")
        self.client.force_authenticate(user=self.user)

    def test_change_password_success(self):
        res = self.client.post(
            "/api/v1/accounts/change-password/",
            {"current_password": "OldPass123!", "new_password": "NewSecure456!", "new_password_confirm": "NewSecure456!"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecure456!"))

    def test_wrong_current_password(self):
        res = self.client.post(
            "/api/v1/accounts/change-password/",
            {"current_password": "WrongPass!", "new_password": "NewSecure456!", "new_password_confirm": "NewSecure456!"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_requires_authentication(self):
        anon = APIClient()
        res = anon.post(
            "/api/v1/accounts/change-password/",
            {"current_password": "OldPass123!", "new_password": "NewSecure456!", "new_password_confirm": "NewSecure456!"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)


# ── ResendEmailVerificationView ────────────────────────────────────────────────

class ResendEmailVerificationViewTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.unverified = make_user(username="unverified", verified=False)

    def test_resend_for_unverified_user_returns_200(self):
        # Always returns 200 regardless of whether email was sent
        res = self.client.post(
            "/api/v1/accounts/email/verify/resend/",
            {"email": self.unverified.email},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_resend_for_unknown_email_still_returns_200(self):
        # Prevents email enumeration
        res = self.client.post(
            "/api/v1/accounts/email/verify/resend/",
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_resend_for_verified_user_returns_200_but_skips_send(self):
        verified = make_user(username="alreadyverified", verified=True)
        res = self.client.post(
            "/api/v1/accounts/email/verify/resend/",
            {"email": verified.email},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
