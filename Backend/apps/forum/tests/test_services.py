"""
Tests for forum services.
"""
from django.contrib.auth.models import Group
from django.test import TestCase

from apps.accounts.models import User
from apps.forum.models import ForumCategory, Topic, Reply, TopicReaction
from apps.forum.services import ForumCategoryService, ReactionService, TopicService


class ForumCategoryServiceTestCase(TestCase):
    """Test cases for ForumCategoryService."""

    def setUp(self):
        self.category_data = {
            "name": "General Discussion",
            "slug": "general-discussion",
            "description": "General topics",
            "display_order": 1,
        }

    def test_create_category_success(self):
        category = ForumCategoryService.create_category(**self.category_data)

        self.assertIsNotNone(category)
        self.assertEqual(category.name, "General Discussion")
        self.assertEqual(category.slug, "general-discussion")
        self.assertTrue(category.is_active)

    def test_create_category_with_icon(self):
        data = self.category_data.copy()
        data["icon"] = "chat"
        category = ForumCategoryService.create_category(**data)

        self.assertEqual(category.icon, "chat")

    def test_get_all_active_only_returns_active(self):
        ForumCategoryService.create_category(**self.category_data)
        inactive_data = self.category_data.copy()
        inactive_data["name"] = "Inactive"
        inactive_data["slug"] = "inactive"
        inactive_data["is_active"] = False
        ForumCategoryService.create_category(**inactive_data)

        active = ForumCategoryService.get_all_active()
        self.assertEqual(active.count(), 1)
        self.assertEqual(active.first().slug, "general-discussion")

    def test_get_by_slug_success(self):
        ForumCategoryService.create_category(**self.category_data)
        category = ForumCategoryService.get_by_slug("general-discussion")

        self.assertIsNotNone(category)
        self.assertEqual(category.name, "General Discussion")

    def test_get_by_slug_not_found(self):
        category = ForumCategoryService.get_by_slug("nonexistent")
        self.assertIsNone(category)


class TopicServiceTestCase(TestCase):
    """Test cases for TopicService."""

    def setUp(self):
        Group.objects.get_or_create(name="players")
        self.user = User.objects.create_user(
            email="user@example.com",
            username="testuser",
            password="TestPass123!"
        )
        self.category = ForumCategoryService.create_category(
            name="Test Category",
            slug="test-category",
        )
        self.topic_data = {
            "title": "Test Topic",
            "content": "This is test content",
        }

    def test_create_topic_success(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )

        self.assertIsNotNone(topic)
        self.assertEqual(topic.title, "Test Topic")
        self.assertEqual(topic.author, self.user)
        self.assertEqual(topic.category, self.category)
        self.assertEqual(topic.status, Topic.Status.OPEN)
        self.assertEqual(topic.reply_count, 0)

    def test_create_topic_increments_category_count(self):
        TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )

        self.category.refresh_from_db()
        self.assertEqual(self.category.topic_count, 1)

    def test_create_topic_with_custom_slug(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            title="Custom Slug Topic",
            content="Content",
            slug="custom-slug"
        )

        self.assertEqual(topic.slug, "custom-slug")

    def test_create_reply_success(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )

        reply = TopicService.create_reply(
            topic=topic,
            content="This is a reply",
            author=self.user
        )

        self.assertIsNotNone(reply)
        self.assertEqual(reply.content, "This is a reply")
        self.assertEqual(reply.topic, topic)

    def test_create_reply_increments_topic_count(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )

        TopicService.create_reply(
            topic=topic,
            content="Reply content",
            author=self.user
        )

        topic.refresh_from_db()
        self.assertEqual(topic.reply_count, 1)

    def test_create_reply_increments_category_count(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )

        TopicService.create_reply(
            topic=topic,
            content="Reply content",
            author=self.user
        )

        self.category.refresh_from_db()
        self.assertEqual(self.category.reply_count, 1)

    def test_create_reply_to_locked_topic_raises_error(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )
        topic.close()

        with self.assertRaises(ValueError) as context:
            TopicService.create_reply(
                topic=topic,
                content="Reply content",
                author=self.user
            )

        self.assertIn("locked", str(context.exception).lower())

    def test_delete_reply_decrements_counts(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )
        reply = TopicService.create_reply(
            topic=topic,
            content="Reply content",
            author=self.user
        )

        TopicService.delete_reply(reply)

        topic.refresh_from_db()
        self.category.refresh_from_db()
        self.assertEqual(topic.reply_count, 0)
        self.assertEqual(self.category.reply_count, 0)

    def test_pin_topic(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )

        pinned_topic = TopicService.pin_topic(topic)
        self.assertTrue(pinned_topic.is_pinned)

    def test_lock_topic(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )

        locked_topic = TopicService.lock_topic(topic)
        self.assertTrue(locked_topic.is_locked)
        self.assertEqual(locked_topic.status, Topic.Status.CLOSED)

    def test_unlock_topic(self):
        topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            **self.topic_data
        )
        topic.close()

        unlocked_topic = TopicService.unlock_topic(topic)
        self.assertFalse(unlocked_topic.is_locked)
        self.assertEqual(unlocked_topic.status, Topic.Status.OPEN)


class ReactionServiceTestCase(TestCase):
    """Test cases for ReactionService."""

    def setUp(self):
        Group.objects.get_or_create(name="players")
        self.user = User.objects.create_user(
            email="user@example.com",
            username="testuser",
            password="TestPass123!"
        )
        self.category = ForumCategoryService.create_category(
            name="Test Category",
            slug="test-category",
        )
        self.topic = TopicService.create_topic(
            author=self.user,
            category=self.category,
            title="Test Topic",
            content="Topic content",
        )
        self.reply = TopicService.create_reply(
            topic=self.topic,
            content="Reply content",
            author=self.user
        )

    def test_add_topic_reaction_like(self):
        reaction = ReactionService.add_topic_reaction(
            topic=self.topic,
            user=self.user,
            reaction="like"
        )

        self.assertIsNotNone(reaction)
        self.assertEqual(reaction.reaction, "like")
        self.assertEqual(reaction.topic, self.topic)

    def test_add_topic_reaction_invalid_type_raises_error(self):
        with self.assertRaises(ValueError) as context:
            ReactionService.add_topic_reaction(
                topic=self.topic,
                user=self.user,
                reaction="invalid"
            )

        self.assertIn("Invalid reaction type", str(context.exception))

    def test_add_topic_reaction_toggle(self):
        ReactionService.add_topic_reaction(
            topic=self.topic,
            user=self.user,
            reaction="like"
        )

        reaction = ReactionService.add_topic_reaction(
            topic=self.topic,
            user=self.user,
            reaction="like"
        )

        self.assertIsNone(reaction)
        self.assertFalse(
            TopicReaction.objects.filter(
                user=self.user,
                topic=self.topic,
                reaction="like"
            ).exists()
        )

    def test_add_topic_reaction_changes_type(self):
        ReactionService.add_topic_reaction(
            topic=self.topic,
            user=self.user,
            reaction="like"
        )

        ReactionService.add_topic_reaction(
            topic=self.topic,
            user=self.user,
            reaction="heart"
        )

        reactions = TopicReaction.objects.filter(user=self.user, topic=self.topic)
        self.assertEqual(reactions.count(), 1)
        self.assertEqual(reactions.first().reaction, "heart")

    def test_add_reply_reaction_success(self):
        reaction = ReactionService.add_reply_reaction(
            reply=self.reply,
            user=self.user,
            reaction="like"
        )

        self.assertIsNotNone(reaction)
        self.assertEqual(reaction.reaction, "like")

    def test_get_topic_reactions_summary(self):
        user2 = User.objects.create_user(
            email="user2@example.com",
            username="testuser2",
            password="TestPass123!"
        )

        ReactionService.add_topic_reaction(self.topic, self.user, "like")
        ReactionService.add_topic_reaction(self.topic, user2, "like")
        ReactionService.add_topic_reaction(self.topic, user2, "heart")

        summary = ReactionService.get_topic_reactions(self.topic)

        self.assertEqual(summary["like"], 1)
        self.assertEqual(summary["heart"], 1)
        self.assertEqual(summary["dislike"], 0)
