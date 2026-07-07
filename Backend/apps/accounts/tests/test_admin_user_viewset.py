from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AdminAuditEvent, User


class AdminUserViewSetTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(email="admin2@example.com", username="admin2", password="Pass1234!")
        self.client.force_authenticate(user=self.admin)
        self.staff_admin = User.objects.create_user(
            email="staffadmin@example.com",
            username="staffadmin",
            password="Pass1234!",
            is_staff=True,
        )
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff_admin)

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

    def test_staff_admin_can_list_and_search_users(self):
        res = self.staff_client.get("/api/v1/accounts/users/?page=1&page_size=10")
        self.assertEqual(res.status_code, 200)

        res_search = self.staff_client.get("/api/v1/accounts/users/search/?q=user1")
        self.assertEqual(res_search.status_code, 200)
        self.assertTrue(any(item["username"] == "user1" for item in res_search.json().get("results", [])))

    def test_audit_filter_accepts_target_username(self):
        AdminAuditEvent.objects.create(
            action="update_user",
            actor=self.admin,
            target=self.user,
            metadata={},
        )

        res = self.staff_client.get("/api/v1/accounts/audit-events/?target=user1")

        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["target"]["username"], "user1")
