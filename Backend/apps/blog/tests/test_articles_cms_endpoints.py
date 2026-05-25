from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blog.models import Post


class ArticlesCmsEndpointsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.editor = User.objects.create_user(email="editor@example.com", password="Pass1234!", username="editor")
        self.editor.is_verified = True
        self.editor.save(update_fields=["is_verified"])
        Group.objects.get_or_create(name="blog_editors")[0].user_set.add(self.editor)

    def test_workflow_history_revert_and_analytics(self):
        self.client.force_authenticate(user=self.editor)

        create_res = self.client.post(
            "/api/v1/blog/articles/",
            {
                "title": "Primeiro",
                "slug": "primeiro",
                "excerpt": "resumo",
                "content": "conteudo original",
                "status": Post.Status.DRAFT,
                "tags": [],
                "category": None,
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, 201)

        hist_res = self.client.get("/api/v1/blog/articles/primeiro/history/")
        self.assertEqual(hist_res.status_code, 200)
        versions = hist_res.json()
        # Revisions are created on update, not creation — empty on fresh post
        self.assertEqual(len(versions), 0)

        update_res = self.client.put(
            "/api/v1/blog/articles/primeiro/",
            {
                "title": "Primeiro",
                "slug": "primeiro",
                "excerpt": "resumo",
                "content": "conteudo atualizado",
                "status": Post.Status.DRAFT,
                "tags": [],
                "category": None,
            },
            format="json",
        )
        self.assertEqual(update_res.status_code, 200)

        hist_res2 = self.client.get("/api/v1/blog/articles/primeiro/history/")
        self.assertEqual(hist_res2.status_code, 200)
        versions2 = hist_res2.json()
        # One update creates one revision (snapshot of the pre-update state)
        self.assertTrue(len(versions2) >= 1)

        oldest = versions2[-1]
        revert_res = self.client.post(
            "/api/v1/blog/articles/primeiro/revert/",
            {"version_id": oldest["id"]},
            format="json",
        )
        self.assertEqual(revert_res.status_code, 200)

        detail_res = self.client.get("/api/v1/blog/articles/primeiro/")
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.json().get("content"), "conteudo original")

        publish_res = self.client.post("/api/v1/blog/articles/primeiro/publish/", {}, format="json")
        self.assertEqual(publish_res.status_code, 200)

        self.client.force_authenticate(user=None)
        view_res = self.client.get("/api/v1/blog/articles/primeiro/")
        self.assertEqual(view_res.status_code, 200)
        view_res2 = self.client.get("/api/v1/blog/articles/primeiro/")
        self.assertEqual(view_res2.status_code, 200)

        self.client.force_authenticate(user=self.editor)
        analytics_res = self.client.get("/api/v1/blog/articles/analytics/")
        self.assertEqual(analytics_res.status_code, 200)
        data = analytics_res.json()
        self.assertTrue(data.get("total_articles", 0) >= 1)
        self.assertTrue(data.get("total_views", 0) >= 2)

    def test_public_comment_requires_approval(self):
        author = User.objects.create_user(email="author@example.com", password="Pass1234!", username="author")
        Post.objects.create(
            title="Hello",
            slug="hello",
            excerpt="hi",
            content="content",
            author=author,
            status=Post.Status.PUBLISHED,
            is_public=True,
        )

        players, _ = Group.objects.get_or_create(name="members")
        player = User.objects.create_user(email="player@example.com", password="Pass1234!", username="player")
        player.groups.add(players)
        player.is_verified = True
        player.save(update_fields=["is_verified"])

        self.client.force_authenticate(user=player)
        create_res = self.client.post(
            "/api/v1/blog/public/comments/",
            {"post_slug": "hello", "content": "Nice!"},
            format="json",
        )
        self.assertEqual(create_res.status_code, 201)
        comment_id = create_res.json()["id"]

        self.client.force_authenticate(user=None)
        list_res = self.client.get("/api/v1/blog/public/comments/?post_slug=hello")
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.json().get("results", [])), 0)

        self.client.force_authenticate(user=self.editor)
        approve_res = self.client.post(f"/api/v1/blog/comments/{comment_id}/approve/", {}, format="json")
        self.assertEqual(approve_res.status_code, 200)

        self.client.force_authenticate(user=None)
        list_res2 = self.client.get("/api/v1/blog/public/comments/?post_slug=hello")
        self.assertEqual(list_res2.status_code, 200)
        self.assertEqual(len(list_res2.json().get("results", [])), 1)
