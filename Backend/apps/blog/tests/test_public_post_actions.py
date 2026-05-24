from django.db import connection
from django.test import TestCase
from unittest import skipUnless
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blog.models import Post


class PublicPostActionsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(
            email="author@example.com",
            password="Pass1234!",
            username="author",
        )
        self.post = Post.objects.create(
            title="Hello",
            slug="hello",
            excerpt="hi",
            content="<p>content</p>",
            author=self.author,
            status=Post.Status.PUBLISHED,
            is_public=True,
            is_featured=True,
        )

    def test_featured_is_public(self):
        res = self.client.get("/api/v1/blog/posts/featured/")
        self.assertEqual(res.status_code, 200)

    @skipUnless(connection.vendor == "postgresql", "Full-text search requires PostgreSQL")
    def test_search_is_public(self):
        res = self.client.get("/api/v1/blog/posts/search/?q=hello&page_size=10")
        self.assertEqual(res.status_code, 200)

    def test_author_email_not_exposed_publicly(self):
        res = self.client.get("/api/v1/blog/posts/hello/")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertNotIn("author_email", payload)
