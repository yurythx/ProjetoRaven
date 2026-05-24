from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User


class SafeTokenRefreshTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_refresh_deleted_user_returns_401(self):
        user = User.objects.create_user(
            email="refresh-user@example.com",
            username="refresh-user",
            password="Pass1234!",
        )
        user.is_verified = True
        user.save(update_fields=["is_verified"])

        refresh = str(RefreshToken.for_user(user))
        user.delete()

        res = self.client.post(
            "/api/v1/accounts/token/refresh/",
            {"refresh": refresh},
            format="json",
        )

        self.assertEqual(res.status_code, 401)

