"""
Tests for author_username field added to PublicPostDetailSerializer.
Ensures the public blog article endpoint exposes the author's username
so the frontend can build /u/<username> profile links.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blog.models import Category, Post


def make_published_post(author, slug="test-article"):
    cat = Category.objects.create(name="News", slug="news", is_active=True)
    return Post.objects.create(
        title="Test Article",
        slug=slug,
        content="<p>Content</p>",
        excerpt="Short excerpt.",
        author=author,
        category=cat,
        status=Post.Status.PUBLISHED,
        is_public=True,
    )


class PublicPostAuthorUsernameTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(
            email="writer@example.com",
            username="thewriter",
            password="Pass1234!",
            display_name="The Writer",
        )
        self.post = make_published_post(self.author)

    def test_public_detail_includes_author_username(self):
        res = self.client.get(f"/api/v1/blog/public/posts/{self.post.slug}/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("author_username", data)
        self.assertEqual(data["author_username"], "thewriter")

    def test_public_detail_includes_author_name(self):
        res = self.client.get(f"/api/v1/blog/public/posts/{self.post.slug}/")
        data = res.json()
        self.assertIn("author_name", data)
        self.assertEqual(data["author_name"], "The Writer")

    def test_public_detail_does_not_expose_author_email(self):
        res = self.client.get(f"/api/v1/blog/public/posts/{self.post.slug}/")
        data = res.json()
        self.assertNotIn("author_email", data)

    def test_draft_post_not_accessible_publicly(self):
        draft = Post.objects.create(
            title="Draft",
            slug="draft-post",
            content="x",
            author=self.author,
            status=Post.Status.DRAFT,
            is_public=False,
        )
        res = self.client.get(f"/api/v1/blog/public/posts/{draft.slug}/")
        self.assertEqual(res.status_code, 404)
