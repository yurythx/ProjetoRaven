"""
Tests for forum views and permissions.
"""
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.forum.models import ForumCategory, Topic, Reply
from apps.forum.views import (
    ForumCategoryViewSet,
    PublicForumCategoryViewSet,
    PublicReplyViewSet,
    PublicTopicViewSet,
    ReplyViewSet,
    TopicViewSet,
)


class ForumViewsTestCase(TestCase):
    """Test cases for forum API endpoints."""

    def setUp(self):
        self.client = APIClient()

        self.players_group, _ = Group.objects.get_or_create(name="players")
        self.mods_group, _ = Group.objects.get_or_create(name="forum_moderators")

        self.player = User.objects.create_user(
            email="player@example.com",
            username="player",
            password="TestPass123!",
        )
        self.player.is_verified = True
        self.player.save(update_fields=["is_verified"])
        self.player.groups.add(self.players_group)

        self.regular_user = User.objects.create_user(
            email="regular@example.com",
            username="regular",
            password="TestPass123!",
        )

        self.moderator = User.objects.create_user(
            email="mod@example.com",
            username="moderator",
            password="TestPass123!",
        )
        self.moderator.is_verified = True
        self.moderator.save(update_fields=["is_verified"])
        self.moderator.groups.add(self.mods_group)

        self.active_category = ForumCategory.objects.create(
            name="General",
            slug="general",
            is_active=True,
        )
        self.other_active_category = ForumCategory.objects.create(
            name="Off-topic",
            slug="off-topic",
            is_active=True,
        )
        self.inactive_category = ForumCategory.objects.create(
            name="Hidden",
            slug="hidden",
            is_active=False,
        )

        self.topic = Topic.objects.create(
            title="Welcome",
            slug="welcome",
            content="First post",
            author=self.player,
            category=self.active_category,
        )
        self.other_topic = Topic.objects.create(
            title="Other",
            slug="other",
            content="Other post",
            author=self.player,
            category=self.other_active_category,
        )

        self.reply1 = Reply.objects.create(
            content="Reply 1",
            author=self.player,
            topic=self.topic,
        )
        self.reply2 = Reply.objects.create(
            content="Reply 2",
            author=self.player,
            topic=self.topic,
        )

    def test_categories_list_is_public_and_only_active(self):
        response = self.client.get("/api/v1/forum/categories/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        results = payload.get("results", payload)
        slugs = [item["slug"] for item in results]
        self.assertIn("general", slugs)
        self.assertNotIn("hidden", slugs)

    def test_create_category_requires_moderator(self):
        self.client.force_authenticate(user=self.player)
        response = self.client.post(
            "/api/v1/forum/categories/",
            {"name": "News", "slug": "news", "description": "Updates"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(
            "/api/v1/forum/categories/",
            {"name": "News", "slug": "news", "description": "Updates"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(ForumCategory.objects.filter(slug="news").exists())

    def test_create_topic_requires_player_or_admin(self):
        payload = {
            "title": "Player Topic",
            "slug": "player-topic",
            "content": "Hello world",
            "category": str(self.active_category.id),
        }

        self.client.force_authenticate(user=self.regular_user)
        response = self.client.post("/api/v1/forum/topics/", payload, format="json")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.player)
        response = self.client.post("/api/v1/forum/topics/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Topic.objects.filter(slug="player-topic").exists())

    def test_topics_list_can_filter_by_category(self):
        response = self.client.get(f"/api/v1/forum/topics/?category={self.active_category.slug}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        results = payload.get("results", payload)
        slugs = [item["slug"] for item in results]
        self.assertIn(self.topic.slug, slugs)
        self.assertNotIn(self.other_topic.slug, slugs)

        response = self.client.get(f"/api/v1/forum/topics/?category={self.other_active_category.id}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        results = payload.get("results", payload)
        slugs = [item["slug"] for item in results]
        self.assertIn(self.other_topic.slug, slugs)
        self.assertNotIn(self.topic.slug, slugs)

    def test_pin_topic_requires_moderator(self):
        self.client.force_authenticate(user=self.player)
        response = self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/pin/")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/pin/")
        self.assertEqual(response.status_code, 200)
        self.topic.refresh_from_db()
        self.assertTrue(self.topic.is_pinned)

    def test_create_reply_requires_player_or_admin(self):
        payload = {"content": "Reply text", "topic": str(self.topic.id)}

        self.client.force_authenticate(user=self.regular_user)
        response = self.client.post("/api/v1/forum/replies/", payload, format="json")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.player)
        response = self.client.post("/api/v1/forum/replies/", payload, format="json")
        self.assertEqual(response.status_code, 201)

    def test_mark_solution_requires_moderator_and_is_unique(self):
        self.client.force_authenticate(user=self.player)
        response = self.client.post(f"/api/v1/forum/replies/{self.reply1.id}/mark_solution/")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(f"/api/v1/forum/replies/{self.reply1.id}/mark_solution/")
        self.assertEqual(response.status_code, 200)
        self.reply1.refresh_from_db()
        self.reply2.refresh_from_db()
        self.assertTrue(self.reply1.is_solution)
        self.assertFalse(self.reply2.is_solution)

        response = self.client.post(f"/api/v1/forum/replies/{self.reply2.id}/mark_solution/")
        self.assertEqual(response.status_code, 200)
        self.reply1.refresh_from_db()
        self.reply2.refresh_from_db()
        self.assertFalse(self.reply1.is_solution)
        self.assertTrue(self.reply2.is_solution)

        response = self.client.post(f"/api/v1/forum/replies/{self.reply2.id}/unmark_solution/")
        self.assertEqual(response.status_code, 200)
        self.reply2.refresh_from_db()
        self.assertFalse(self.reply2.is_solution)

    def test_hide_and_unhide_reply_requires_moderator(self):
        self.client.force_authenticate(user=self.player)
        response = self.client.post(f"/api/v1/forum/replies/{self.reply1.id}/hide/", {"reason": "spam"}, format="json")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.moderator)
        response = self.client.post(f"/api/v1/forum/replies/{self.reply1.id}/hide/", {"reason": "spam"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.reply1.refresh_from_db()
        self.assertTrue(self.reply1.is_hidden)

        response = self.client.post(f"/api/v1/forum/replies/{self.reply1.id}/unhide/")
        self.assertEqual(response.status_code, 200)
        self.reply1.refresh_from_db()
        self.assertFalse(self.reply1.is_hidden)

    def test_list_replies_include_hidden_requires_moderator(self):
        self.client.force_authenticate(user=self.moderator)
        self.client.post(f"/api/v1/forum/replies/{self.reply1.id}/hide/", {"reason": "spam"}, format="json")
        self.reply1.refresh_from_db()
        self.assertTrue(self.reply1.is_hidden)

        self.client.force_authenticate(user=self.player)
        response = self.client.get(f"/api/v1/forum/replies/?topic={self.topic.slug}&include_hidden=1")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=self.moderator)
        response = self.client.get(f"/api/v1/forum/replies/?topic={self.topic.slug}&include_hidden=1")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        results = payload.get("results", payload)
        ids = [item["id"] for item in results]
        self.assertIn(str(self.reply1.id), ids)

    def test_public_endpoints_exist_and_hide_hidden_content(self):
        res_cats = self.client.get("/api/v1/forum/public/categories/")
        self.assertEqual(res_cats.status_code, 200)
        payload = res_cats.json()
        results = payload.get("results", payload)
        slugs = [item["slug"] for item in results]
        self.assertIn("general", slugs)
        self.assertNotIn("hidden", slugs)

        res_topics = self.client.get(f"/api/v1/forum/public/topics/?category={self.active_category.slug}")
        self.assertEqual(res_topics.status_code, 200)
        payload = res_topics.json()
        results = payload.get("results", payload)
        topic_slugs = [item["slug"] for item in results]
        self.assertIn(self.topic.slug, topic_slugs)
        self.assertNotIn(self.other_topic.slug, topic_slugs)

        self.client.force_authenticate(user=self.moderator)
        self.client.post(f"/api/v1/forum/replies/{self.reply1.id}/hide/", {"reason": "spam"}, format="json")
        self.reply1.refresh_from_db()
        self.assertTrue(self.reply1.is_hidden)
        self.client.force_authenticate(user=None)

        res_replies = self.client.get(f"/api/v1/forum/public/replies/?topic={self.topic.slug}&page_size=100")
        self.assertEqual(res_replies.status_code, 200)
        payload = res_replies.json()
        results = payload.get("results", payload)
        ids = [item["id"] for item in results]
        self.assertNotIn(str(self.reply1.id), ids)

    def test_public_categories_supports_page_size(self):
        res = self.client.get("/api/v1/forum/public/categories/?page=1&page_size=1")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        results = payload.get("results", payload)
        self.assertEqual(len(results), 1)

    def test_viewsets_have_throttling_enabled(self):
        self.assertTrue(PublicForumCategoryViewSet.throttle_classes)
        self.assertTrue(PublicTopicViewSet.throttle_classes)
        self.assertTrue(PublicReplyViewSet.throttle_classes)
        self.assertTrue(ForumCategoryViewSet.throttle_classes)
        self.assertTrue(TopicViewSet.throttle_classes)
        self.assertTrue(ReplyViewSet.throttle_classes)

    def test_public_topics_supports_search_and_ordering_allowlist(self):
        res_search = self.client.get("/api/v1/forum/public/topics/?q=Welcome&page=1&page_size=50")
        self.assertEqual(res_search.status_code, 200)
        payload = res_search.json()
        results = payload.get("results", payload)
        slugs = [item["slug"] for item in results]
        self.assertIn(self.topic.slug, slugs)

        res_order = self.client.get("/api/v1/forum/public/topics/?ordering=-view_count&page=1&page_size=50")
        self.assertEqual(res_order.status_code, 200)

        res_bad = self.client.get("/api/v1/forum/public/topics/?ordering=-__class__&page=1&page_size=50")
        self.assertEqual(res_bad.status_code, 200)
