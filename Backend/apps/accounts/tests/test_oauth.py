"""Tests for OAuth 2.0 service and views."""

from unittest.mock import MagicMock, patch

from django.core.signing import TimestampSigner
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import SocialAccount, User
from apps.accounts.services import oauth as oauth_service


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(email="hero@example.com", username="hero", verified=True):
    return User.objects.create_user(
        email=email, username=username, password="TestPass123!",
        is_verified=verified, is_active=True,
    )


def _signed_state():
    raw = oauth_service.generate_state()
    return TimestampSigner().sign(raw)


# ── Service tests ───────────────────────────────────────────────────────────────

@override_settings(
    OAUTH_GOOGLE_CLIENT_ID="google-id",
    OAUTH_GOOGLE_CLIENT_SECRET="google-secret",
    OAUTH_DISCORD_CLIENT_ID="discord-id",
    OAUTH_DISCORD_CLIENT_SECRET="discord-secret",
)
class GoogleAuthUrlTest(TestCase):
    def test_returns_url_with_client_id(self):
        url = oauth_service.google_auth_url("https://example.com/cb", "state123")
        self.assertIn("accounts.google.com", url)
        self.assertIn("google-id", url)
        self.assertIn("state123", url)

    def test_raises_when_client_id_missing(self):
        with override_settings(OAUTH_GOOGLE_CLIENT_ID=""):
            with self.assertRaises(ValueError):
                oauth_service.google_auth_url("https://example.com/cb", "s")


@override_settings(OAUTH_DISCORD_CLIENT_ID="discord-id", OAUTH_DISCORD_CLIENT_SECRET="discord-secret")
class DiscordAuthUrlTest(TestCase):
    def test_returns_url_with_client_id(self):
        url = oauth_service.discord_auth_url("https://example.com/cb", "state456")
        self.assertIn("discord.com", url)
        self.assertIn("discord-id", url)

    def test_raises_when_client_id_missing(self):
        with override_settings(OAUTH_DISCORD_CLIENT_ID=""):
            with self.assertRaises(ValueError):
                oauth_service.discord_auth_url("https://example.com/cb", "s")


class GetOrCreateUserTest(TestCase):
    USER_INFO = {
        "provider_uid": "uid-abc",
        "email": "hero@example.com",
        "display_name": "Hero Name",
        "avatar_url": "",
        "extra_data": {},
    }

    def test_creates_new_user_when_none_exists(self):
        user, created = oauth_service.get_or_create_user("google", self.USER_INFO)
        self.assertTrue(created)
        self.assertEqual(user.email, "hero@example.com")
        self.assertTrue(user.is_verified)
        self.assertTrue(SocialAccount.objects.filter(provider="google", user=user).exists())

    def test_returns_existing_user_by_social_account(self):
        existing = _make_user()
        SocialAccount.objects.create(
            user=existing, provider="google", provider_uid="uid-abc", extra_data={}
        )
        user, created = oauth_service.get_or_create_user("google", self.USER_INFO)
        self.assertFalse(created)
        self.assertEqual(user.pk, existing.pk)

    def test_links_to_existing_user_by_email(self):
        existing = _make_user()
        user, created = oauth_service.get_or_create_user("google", self.USER_INFO)
        self.assertFalse(created)
        self.assertEqual(user.pk, existing.pk)
        self.assertTrue(SocialAccount.objects.filter(provider="google", user=existing).exists())

    def test_verifies_unverified_existing_user(self):
        existing = _make_user(verified=False)
        existing.is_verified = False
        existing.save()
        user, _ = oauth_service.get_or_create_user("google", self.USER_INFO)
        user.refresh_from_db()
        self.assertTrue(user.is_verified)

    def test_updates_extra_data_on_existing_social_account(self):
        existing = _make_user()
        sa = SocialAccount.objects.create(
            user=existing, provider="google", provider_uid="uid-abc", extra_data={"old": True}
        )
        info = {**self.USER_INFO, "extra_data": {"new": True}}
        oauth_service.get_or_create_user("google", info)
        sa.refresh_from_db()
        self.assertEqual(sa.extra_data, {"new": True})

    def test_unique_username_deduplication(self):
        User.objects.create_user(email="a@b.com", username="Hero_Name", password=None)
        info = {**self.USER_INFO, "email": "other@example.com"}
        user, created = oauth_service.get_or_create_user("google", info)
        self.assertTrue(created)
        self.assertNotEqual(user.username, "Hero_Name")

    def test_discord_provider_creates_separate_social_account(self):
        user_google, _ = oauth_service.get_or_create_user("google", self.USER_INFO)
        info_discord = {**self.USER_INFO, "provider_uid": "discord-uid-xyz"}
        user_discord, created = oauth_service.get_or_create_user("discord", info_discord)
        self.assertFalse(created)
        self.assertEqual(user_google.pk, user_discord.pk)
        self.assertEqual(SocialAccount.objects.filter(user=user_google).count(), 2)


# ── View tests ──────────────────────────────────────────────────────────────────

@override_settings(
    OAUTH_GOOGLE_CLIENT_ID="google-id",
    OAUTH_GOOGLE_CLIENT_SECRET="google-secret",
    OAUTH_DISCORD_CLIENT_ID="discord-id",
    OAUTH_DISCORD_CLIENT_SECRET="discord-secret",
)
class OAuthInitViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_google_returns_auth_url_and_state(self):
        resp = self.client.get(
            "/api/v1/accounts/oauth/google/",
            {"redirect_uri": "https://example.com/cb"}
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("auth_url", resp.data)
        self.assertIn("state", resp.data)
        self.assertIn("accounts.google.com", resp.data["auth_url"])

    def test_discord_returns_auth_url_and_state(self):
        resp = self.client.get(
            "/api/v1/accounts/oauth/discord/",
            {"redirect_uri": "https://example.com/cb"}
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("discord.com", resp.data["auth_url"])

    def test_unknown_provider_returns_400(self):
        resp = self.client.get(
            "/api/v1/accounts/oauth/github/",
            {"redirect_uri": "https://example.com/cb"}
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_redirect_uri_returns_400(self):
        resp = self.client.get("/api/v1/accounts/oauth/google/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unconfigured_client_id_returns_503(self):
        with override_settings(OAUTH_GOOGLE_CLIENT_ID=""):
            resp = self.client.get(
                "/api/v1/accounts/oauth/google/",
                {"redirect_uri": "https://example.com/cb"}
            )
            self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


@override_settings(
    OAUTH_GOOGLE_CLIENT_ID="google-id",
    OAUTH_GOOGLE_CLIENT_SECRET="google-secret",
)
class OAuthCallbackViewTest(TestCase):
    REDIRECT_URI = "https://example.com/cb"
    PROVIDER = "google"

    def setUp(self):
        self.client = APIClient()

    def _post(self, code="authcode", state=None, redirect_uri=None):
        return self.client.post(
            f"/api/v1/accounts/oauth/{self.PROVIDER}/callback/",
            {
                "code": code,
                "state": state or _signed_state(),
                "redirect_uri": redirect_uri or self.REDIRECT_URI,
            },
            format="json",
        )

    def test_invalid_state_returns_400(self):
        resp = self._post(state="tampered.state.value")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid", resp.data.get("error", ""))

    def test_missing_fields_returns_400(self):
        resp = self.client.post(
            f"/api/v1/accounts/oauth/{self.PROVIDER}/callback/",
            {"code": "x"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_provider_returns_400(self):
        resp = self.client.post(
            "/api/v1/accounts/oauth/github/callback/",
            {"code": "x", "state": _signed_state(), "redirect_uri": self.REDIRECT_URI},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_provider_exchange_failure_returns_502(self):
        with patch("apps.accounts.services.oauth.http_requests.post") as mock_post:
            mock_post.side_effect = Exception("Connection refused")
            resp = self._post()
        self.assertEqual(resp.status_code, status.HTTP_502_BAD_GATEWAY)

    def _with_exchange(self, user_info: dict):
        """Context manager that replaces the google exchange fn in _PROVIDERS."""
        import apps.accounts.api.oauth as oauth_api
        original = oauth_api._PROVIDERS["google"]
        mock_fn = MagicMock(return_value=user_info)
        oauth_api._PROVIDERS["google"] = (original[0], mock_fn)
        return original, oauth_api

    def test_new_user_created_returns_201(self):
        import apps.accounts.api.oauth as oauth_api
        original = oauth_api._PROVIDERS["google"]
        mock_user_info = {
            "provider_uid": "google-uid-999",
            "email": "newuser@example.com",
            "display_name": "New User",
            "avatar_url": "",
            "extra_data": {},
        }
        oauth_api._PROVIDERS["google"] = (original[0], MagicMock(return_value=mock_user_info))
        try:
            resp = self._post()
        finally:
            oauth_api._PROVIDERS["google"] = original

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertTrue(resp.data["created"])

    def test_existing_user_returns_200(self):
        import apps.accounts.api.oauth as oauth_api
        original = oauth_api._PROVIDERS["google"]
        existing = _make_user(email="existing@example.com", username="existing")
        SocialAccount.objects.create(
            user=existing, provider="google", provider_uid="google-existing-uid", extra_data={}
        )
        mock_user_info = {
            "provider_uid": "google-existing-uid",
            "email": "existing@example.com",
            "display_name": "Existing",
            "avatar_url": "",
            "extra_data": {},
        }
        oauth_api._PROVIDERS["google"] = (original[0], MagicMock(return_value=mock_user_info))
        try:
            resp = self._post()
        finally:
            oauth_api._PROVIDERS["google"] = original

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["created"])

    def test_banned_user_returns_403(self):
        import apps.accounts.api.oauth as oauth_api
        original = oauth_api._PROVIDERS["google"]
        existing = _make_user(email="banned@example.com", username="banned")
        existing.is_banned = True
        existing.save()
        SocialAccount.objects.create(
            user=existing, provider="google", provider_uid="banned-uid", extra_data={}
        )
        mock_user_info = {
            "provider_uid": "banned-uid",
            "email": "banned@example.com",
            "display_name": "Banned",
            "avatar_url": "",
            "extra_data": {},
        }
        oauth_api._PROVIDERS["google"] = (original[0], MagicMock(return_value=mock_user_info))
        try:
            resp = self._post()
        finally:
            oauth_api._PROVIDERS["google"] = original

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class ConnectedAccountsViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user()
        self.client.force_authenticate(user=self.user)

    def test_returns_empty_list_when_no_accounts(self):
        resp = self.client.get("/api/v1/accounts/oauth/connected/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [])

    def test_returns_connected_accounts(self):
        SocialAccount.objects.create(
            user=self.user, provider="google", provider_uid="g-uid-1", extra_data={}
        )
        SocialAccount.objects.create(
            user=self.user, provider="discord", provider_uid="d-uid-2", extra_data={}
        )
        resp = self.client.get("/api/v1/accounts/oauth/connected/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 2)
        providers = {a["provider"] for a in resp.data}
        self.assertIn("google", providers)
        self.assertIn("discord", providers)

    def test_does_not_return_other_users_accounts(self):
        other = _make_user("other@example.com", "other")
        SocialAccount.objects.create(
            user=other, provider="google", provider_uid="other-uid", extra_data={}
        )
        resp = self.client.get("/api/v1/accounts/oauth/connected/")
        self.assertEqual(resp.data, [])

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get("/api/v1/accounts/oauth/connected/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
