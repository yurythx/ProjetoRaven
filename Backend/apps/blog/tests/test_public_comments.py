from django.test import TestCase
from rest_framework.test import APIClient

from django.contrib.auth.models import Group

from apps.accounts.models import User
from apps.blog.models import Post


class PublicCommentsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(email="author@example.com", password="Pass1234!", username="author")
        self.post = Post.objects.create(
            title="Hello",
            slug="hello",
            excerpt="hi",
            content="content",
            author=self.author,
            status=Post.Status.PUBLISHED,
            is_public=True,
        )

    def test_public_comments_create_and_list(self):
        players, _ = Group.objects.get_or_create(name="players")
        player = User.objects.create_user(email="player@example.com", password="Pass1234!", username="player")
        player.groups.add(players)
        player.is_verified = True
        player.save(update_fields=["is_verified"])
        self.client.force_authenticate(user=player)
        response = self.client.post(
            "/api/v1/blog/public/comments/",
            {"post_slug": "hello", "content": "Nice!"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["content"], "Nice!")
        self.assertFalse(payload["is_approved"])

        self.client.force_authenticate(user=None)
        response = self.client.get("/api/v1/blog/public/comments/?post_slug=hello")
        self.assertEqual(response.status_code, 200)
        items = response.json()
        self.assertEqual(len(items.get("results", [])), 0)

    def test_public_comments_cannot_target_draft_posts(self):
        Post.objects.create(
            title="Draft",
            slug="draft",
            excerpt="e",
            content="c",
            author=self.author,
            status=Post.Status.DRAFT,
            is_public=True,
        )
        players, _ = Group.objects.get_or_create(name="players")
        player = User.objects.create_user(email="player2@example.com", password="Pass1234!", username="player2")
        player.groups.add(players)
        player.is_verified = True
        player.save(update_fields=["is_verified"])
        self.client.force_authenticate(user=player)
        response = self.client.post(
            "/api/v1/blog/public/comments/",
            {"post_slug": "draft", "content": "Nice!"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
