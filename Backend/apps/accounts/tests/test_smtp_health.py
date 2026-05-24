from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


class SMTPHealthTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email="admin@example.com", username="admin", password="Pass1234!")
        self.admin.is_staff = True
        self.admin.save(update_fields=["is_staff"])
        self.client.force_authenticate(user=self.admin)

    def test_health_disabled_when_not_configured(self):
        res = self.client.get("/api/v1/accounts/smtp-settings/health/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "disabled")

