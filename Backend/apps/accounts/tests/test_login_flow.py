from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


class LoginFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="user@example.com",
            username="user",
            password="Pass1234!",
        )
        self.user.is_verified = True
        self.user.save(update_fields=["is_verified"])

    def test_login_sets_last_login_ip(self):
        res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": "user@example.com", "password": "Pass1234!"},
            format="json",
            REMOTE_ADDR="203.0.113.10",
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_login_ip, "203.0.113.10")

