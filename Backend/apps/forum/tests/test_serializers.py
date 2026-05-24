"""
Tests for forum serializers.
"""
from django.contrib.auth.models import Group
from django.test import TestCase

from apps.accounts.models import User
from apps.forum.models import ForumCategory, Reply, Topic
from apps.forum.serializers.category import ForumCategoryListSerializer
from apps.forum.serializers.topic import (
    TopicCreateSerializer,
    TopicDetailSerializer,
    TopicListSerializer,
    TopicUpdateSerializer,
)
from apps.forum.serializers.reply import (
    ReplyCreateSerializer,
    ReplyListSerializer,
)


def make_user(**kwargs):
    defaults = {"email": "u@test.com", "username": "testuser", "password": "Pass123!"}
    defaults.update(kwargs)
    Group.objects.get_or_create(name="players")
    return User.objects.create_user(**defaults)


def make_category(**kwargs):
    defaults = {"name": "General", "slug": "general"}
    defaults.update(kwargs)
    return ForumCategory.objects.create(**defaults)


def make_topic(author, category, **kwargs):
    defaults = {
        "title": "Test Topic",
        "slug": "test-topic",
        "content": "Topic content",
    }
    defaults.update(kwargs)
    return Topic.objects.create(author=author, category=category, **defaults)


class ForumCategorySerializerTest(TestCase):
    def test_serializes_category(self):
        cat = make_category(name="Tech", slug="tech")
        data = ForumCategoryListSerializer(cat).data
        self.assertEqual(data["name"], "Tech")
        self.assertEqual(data["slug"], "tech")

    def test_contains_counters(self):
        cat = make_category()
        data = ForumCategoryListSerializer(cat).data
        self.assertIn("topic_count", data)
        self.assertIn("reply_count", data)
        self.assertEqual(data["topic_count"], 0)
        self.assertEqual(data["reply_count"], 0)


class TopicListSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()
        self.topic = make_topic(self.user, self.category)

    def test_serializes_topic(self):
        data = TopicListSerializer(self.topic).data
        self.assertEqual(data["title"], "Test Topic")
        self.assertEqual(data["slug"], "test-topic")

    def test_category_name_present(self):
        data = TopicListSerializer(self.topic).data
        self.assertEqual(data["category_name"], "General")

    def test_counters_present(self):
        data = TopicListSerializer(self.topic).data
        self.assertIn("reply_count", data)
        self.assertIn("view_count", data)
        self.assertEqual(data["reply_count"], 0)

    def test_author_nested(self):
        data = TopicListSerializer(self.topic).data
        self.assertIsInstance(data["author"], dict)
        self.assertIn("username", data["author"])


class TopicDetailSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()
        self.topic = make_topic(self.user, self.category)

    def test_contains_content(self):
        data = TopicDetailSerializer(self.topic).data
        self.assertIn("content", data)
        self.assertEqual(data["content"], "Topic content")

    def test_category_nested(self):
        data = TopicDetailSerializer(self.topic).data
        self.assertIsInstance(data["category"], dict)
        self.assertEqual(data["category"]["name"], "General")


class TopicCreateSerializerTest(TestCase):
    def setUp(self):
        self.category = make_category()

    def test_valid_data(self):
        data = {
            "title": "New Topic",
            "content": "Content here",
            "category": self.category.id,
        }
        serializer = TopicCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_slug_optional(self):
        data = {
            "title": "No Slug Topic",
            "content": "Content",
            "category": self.category.id,
        }
        serializer = TopicCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_duplicate_slug_invalid(self):
        user = make_user()
        make_topic(user, self.category, slug="taken-slug")
        data = {
            "title": "Another",
            "content": "Content",
            "category": self.category.id,
            "slug": "taken-slug",
        }
        serializer = TopicCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("slug", serializer.errors)

    def test_inactive_category_invalid(self):
        inactive_cat = make_category(name="Inactive", slug="inactive", is_active=False)
        data = {
            "title": "Topic",
            "content": "Content",
            "category": inactive_cat.id,
        }
        serializer = TopicCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("category", serializer.errors)

    def test_invalid_slug_format(self):
        data = {
            "title": "Bad Slug",
            "content": "Content",
            "category": self.category.id,
            "slug": "invalid slug with spaces",
        }
        serializer = TopicCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("slug", serializer.errors)


class TopicUpdateSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()
        self.topic = make_topic(self.user, self.category)

    def test_valid_update(self):
        data = {"title": "Updated Title", "content": "Updated content"}
        serializer = TopicUpdateSerializer(self.topic, data=data, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_duplicate_slug_on_update_invalid(self):
        other_user = make_user(email="other@test.com", username="other")
        make_topic(other_user, self.category, slug="other-slug")
        data = {"title": "OK", "content": "OK", "slug": "other-slug"}
        serializer = TopicUpdateSerializer(self.topic, data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("slug", serializer.errors)

    def test_same_slug_on_self_valid(self):
        data = {"title": "OK", "content": "OK", "slug": self.topic.slug}
        serializer = TopicUpdateSerializer(self.topic, data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)


class ReplyCreateSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()
        self.topic = make_topic(self.user, self.category)

    def test_valid_reply(self):
        data = {"content": "This is a reply", "topic": self.topic.id}
        serializer = ReplyCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_content_required(self):
        data = {"topic": self.topic.id}
        serializer = ReplyCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("content", serializer.errors)

    def test_topic_required(self):
        data = {"content": "Reply without topic"}
        serializer = ReplyCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("topic", serializer.errors)


class ReplyListSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()
        self.topic = make_topic(self.user, self.category)

    def test_serializes_reply(self):
        reply = Reply.objects.create(topic=self.topic, author=self.user, content="A reply")
        data = ReplyListSerializer(reply).data
        self.assertEqual(data["content"], "A reply")
        self.assertFalse(data["is_solution"])
        self.assertFalse(data["is_hidden"])

    def test_author_nested(self):
        reply = Reply.objects.create(topic=self.topic, author=self.user, content="Reply")
        data = ReplyListSerializer(reply).data
        self.assertIsInstance(data["author"], dict)
        self.assertIn("username", data["author"])

    def test_reactions_present(self):
        reply = Reply.objects.create(topic=self.topic, author=self.user, content="Reply")
        data = ReplyListSerializer(reply).data
        self.assertIn("reactions", data)
        self.assertIsInstance(data["reactions"], dict)
