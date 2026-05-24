from django.test import TestCase
from rest_framework.test import APIClient
import hashlib
import json
import os


class HealthEndpointsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_live(self):
        res = self.client.get("/api/health/live/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "ok")

    def test_ready(self):
        res = self.client.get("/api/health/ready/")
        self.assertIn(res.status_code, [200, 503])
        payload = res.json()
        self.assertIn(payload.get("status"), ["ok", "degraded"])
        self.assertIn("checks", payload)
        self.assertIn("db", payload["checks"])
        self.assertIn("cache", payload["checks"])
        self.assertIn("timestamp", payload)

    def test_detailed(self):
        res = self.client.get("/api/health/detailed/")
        self.assertIn(res.status_code, [200, 503])
        payload = res.json()
        self.assertIn("status", payload)
        self.assertIn("checks", payload)
        self.assertIn("stats", payload)
        self.assertIn("timestamp", payload)

    def test_version(self):
        res = self.client.get("/api/health/version/")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn("version", payload)
        self.assertIn("build_sha", payload)
        self.assertIn("build_time", payload)

    def test_openapi_schema_contract(self):
        from drf_spectacular.generators import SchemaGenerator

        schema = SchemaGenerator().get_schema(request=None, public=True)
        self.assertTrue(schema)
        self.assertIn("openapi", schema)

        raw = json.dumps(schema, sort_keys=True, separators=(",", ":")).encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()

        expected = (os.environ.get("OPENAPI_SCHEMA_SHA256") or "").strip()
        if expected:
            self.assertEqual(digest, expected)
