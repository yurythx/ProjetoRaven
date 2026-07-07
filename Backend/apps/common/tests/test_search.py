from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blog.models import Category, Post
from apps.forum.models import ForumCategory, Topic


TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "search-tests",
    }
}


@override_settings(CACHES=TEST_CACHES)
class GlobalSearchViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")

        self.user = User.objects.create_user(
            email="search@test.com",
            username="searcher",
            password="Pass123!",
        )
        self.user.display_name = "Searcher"
        self.user.save(update_fields=["display_name"])

        self.blog_category = Category.objects.create(name="Guias", slug="guias")
        self.forum_category = ForumCategory.objects.create(name="Ajuda", slug="ajuda", is_active=True)

        self.post = Post.objects.create(
            title="Guia Raven",
            slug="guia-raven",
            excerpt="Resumo do guia",
            content="Conteudo detalhado sobre a busca do Raven.",
            author=self.user,
            category=self.blog_category,
            status=Post.Status.PUBLISHED,
            is_public=True,
        )

        self.topic = Topic.objects.create(
            title="Guia do Forum",
            slug="guia-forum",
            content="Discussao sobre busca no forum.",
            author=self.user,
            category=self.forum_category,
            status=Topic.Status.OPEN,
        )

        Topic.objects.create(
            title="Guia Arquivado",
            slug="guia-arquivado",
            content="Esse topico nao deve aparecer.",
            author=self.user,
            category=self.forum_category,
            status=Topic.Status.ARCHIVED,
        )

    def test_global_search_accepts_search_alias_and_returns_results(self):
        response = self.client.get("/api/v1/search/", {"search": "Guia"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["query"], "Guia")
        self.assertEqual(payload["posts"][0]["slug"], self.post.slug)
        self.assertEqual(payload["topics"][0]["slug"], self.topic.slug)

    def test_global_search_handles_invalid_limit(self):
        response = self.client.get("/api/v1/search/", {"q": "Guia", "limit": "invalid"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(any(item["slug"] == self.post.slug for item in payload["posts"]))
        self.assertTrue(any(item["slug"] == self.topic.slug for item in payload["topics"]))

    def test_global_search_excludes_archived_topics(self):
        response = self.client.get("/api/v1/search/", {"q": "Arquivado"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["topics"], [])

