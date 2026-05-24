from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


class AdminDiagnosticsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email="admin@example.com", username="admin", password="Pass1234!")
        self.admin.is_staff = True
        self.admin.save(update_fields=["is_staff"])
        self.client.force_authenticate(user=self.admin)

    def test_admin_diagnostics_does_not_expose_secrets(self):
        res = self.client.get("/api/v1/accounts/admin/diagnostics/")
        self.assertIn(res.status_code, [200, 503])
        payload = res.json()
        self.assertIn("smtp", payload)
        self.assertIn("password_set", payload["smtp"])
        self.assertNotIn("password", payload["smtp"])
