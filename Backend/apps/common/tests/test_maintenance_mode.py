from django.core.cache import caches
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


class MaintenanceModeTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(
        DEBUG=True,
        CACHES={
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "test-maintenance",
            }
        },
    )
    def test_maintenance_returns_503_for_api_requests(self):
        cache = caches["default"]
        cache.set("maintenance:mode", {"message": "Restore em andamento"}, timeout=30)
        try:
            health = self.client.get("/api/health/live/")
            self.assertEqual(health.status_code, 200)

            other = self.client.get("/api/v1/accounts/me/")
            self.assertEqual(other.status_code, 503)
            self.assertEqual(other.json().get("error"), "maintenance")
        finally:
            cache.delete("maintenance:mode")
