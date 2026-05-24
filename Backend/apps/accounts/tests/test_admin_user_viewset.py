from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AdminAuditEvent, User


class AdminUserViewSetTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(email="admin2@example.com", username="admin2", password="Pass1234!")
        self.client.force_authenticate(user=self.admin)

        self.user = User.objects.create_user(email="user1@example.com", username="user1", password="Pass1234!")

    def test_list_supports_page_size_and_filtering(self):
        res = self.client.get("/api/v1/accounts/users/?page=1&page_size=1")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(len(payload.get("results", [])), 1)

        res2 = self.client.get("/api/v1/accounts/users/?is_active=true&page=1&page_size=50")
        self.assertEqual(res2.status_code, 200)

    def test_cannot_ban_or_deactivate_self(self):
        res = self.client.post(f"/api/v1/accounts/users/{self.admin.id}/deactivate/")
        self.assertEqual(res.status_code, 403)

        res2 = self.client.post(f"/api/v1/accounts/users/{self.admin.id}/ban/", {"reason": "Motivo válido para banimento"}, format="json")
        self.assertEqual(res2.status_code, 403)

    def test_update_records_audit_with_ip_and_user_agent(self):
        res = self.client.patch(
            f"/api/v1/accounts/users/{self.user.id}/",
            {"is_staff": True},
            format="json",
            HTTP_X_FORWARDED_FOR="203.0.113.10, 10.0.0.1",
            HTTP_USER_AGENT="pytest-agent",
        )
        self.assertEqual(res.status_code, 200)

        ev = AdminAuditEvent.objects.filter(action="update_user", target=self.user).order_by("-created_at").first()
        self.assertIsNotNone(ev)
        self.assertEqual(ev.ip_address, "203.0.113.10")
        self.assertEqual(ev.user_agent, "pytest-agent")
