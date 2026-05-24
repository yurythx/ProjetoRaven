from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.forum.models import ForumCategory, Topic, Reply
from apps.forum.services import TopicService


class ForumSecurityAndCountersTestCase(TestCase):
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

        self.moderator = User.objects.create_user(
            email="mod@example.com",
            username="moderator",
            password="TestPass123!",
        )
        self.moderator.is_verified = True
        self.moderator.save(update_fields=["is_verified"])
        self.moderator.groups.add(self.mods_group)

        self.category = ForumCategory.objects.create(
            name="General",
            slug="general",
            is_active=True,
        )

    def test_topic_reactions_summary_is_public(self):
        topic = Topic.objects.create(
            title="Welcome",
            slug="welcome",
            content="First post",
            author=self.player,
            category=self.category,
        )

        res = self.client.get(f"/api/v1/forum/topics/{topic.slug}/reactions/")
        self.assertEqual(res.status_code, 200)

    def test_topic_reaction_viewset_does_not_allow_listing(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.get("/api/v1/forum/topic-reactions/")
        self.assertEqual(res.status_code, 405)

    def test_delete_reply_updates_denormalized_counters(self):
        self.client.force_authenticate(user=self.player)
        topic = TopicService.create_topic(
            title="Topic",
            slug="topic",
            content="<p>Body</p>",
            category=self.category,
            author=self.player,
        )
        reply = TopicService.create_reply(
            topic=topic,
            content="<p>Reply</p>",
            author=self.player,
        )

        topic.refresh_from_db()
        self.category.refresh_from_db()
        self.assertEqual(topic.reply_count, 1)
        self.assertEqual(self.category.reply_count, 1)

        res = self.client.delete(f"/api/v1/forum/replies/{reply.id}/")
        self.assertEqual(res.status_code, 204)

        topic.refresh_from_db()
        self.category.refresh_from_db()
        self.assertEqual(topic.reply_count, 0)
        self.assertEqual(self.category.reply_count, 0)

    def test_delete_topic_updates_denormalized_counters(self):
        self.client.force_authenticate(user=self.player)
        topic = TopicService.create_topic(
            title="Topic",
            slug="topic-2",
            content="<p>Body</p>",
            category=self.category,
            author=self.player,
        )
        TopicService.create_reply(topic=topic, content="<p>Reply</p>", author=self.player)
        TopicService.create_reply(topic=topic, content="<p>Reply2</p>", author=self.player)

        self.category.refresh_from_db()
        topic.refresh_from_db()
        self.assertEqual(self.category.topic_count, 1)
        self.assertEqual(self.category.reply_count, 2)
        self.assertEqual(topic.reply_count, 2)

        res = self.client.delete(f"/api/v1/forum/topics/{topic.slug}/")
        self.assertEqual(res.status_code, 204)

        self.category.refresh_from_db()
        self.assertEqual(self.category.topic_count, 0)
        self.assertEqual(self.category.reply_count, 0)
        self.assertFalse(Topic.objects.filter(id=topic.id).exists())

    def test_cannot_create_duplicate_slug(self):
        self.client.force_authenticate(user=self.player)
        payload = {
            "title": "First",
            "slug": "dup",
            "content": "<p>x</p>",
            "category": str(self.category.id),
        }
        res1 = self.client.post("/api/v1/forum/topics/", payload, format="json")
        self.assertEqual(res1.status_code, 201)

        payload2 = {**payload, "title": "Second"}
        res2 = self.client.post("/api/v1/forum/topics/", payload2, format="json")
        self.assertEqual(res2.status_code, 400)
