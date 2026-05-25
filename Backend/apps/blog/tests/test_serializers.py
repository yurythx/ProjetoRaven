"""
Tests for blog serializers.
"""
from django.contrib.auth.models import Group
from django.test import TestCase, RequestFactory

from apps.accounts.models import User
from apps.blog.models import Category, Post, Tag
from apps.blog.serializers.category import CategorySerializer
from apps.blog.serializers.tag import TagSerializer
from apps.blog.serializers.post import (
    PostListSerializer,
    PostDetailSerializer,
    PublicPostDetailSerializer,
)
from apps.blog.serializers.comment import CommentListSerializer


def make_user(**kwargs):
    defaults = {"email": "u@test.com", "username": "testuser", "password": "Pass123!"}
    defaults.update(kwargs)
    Group.objects.get_or_create(name="members")
    return User.objects.create_user(**defaults)


def make_category(**kwargs):
    defaults = {"name": "Tech", "slug": "tech"}
    defaults.update(kwargs)
    return Category.objects.create(**defaults)


def make_post(author, category=None, **kwargs):
    defaults = {
        "title": "Test Post",
        "slug": "test-post",
        "excerpt": "Short excerpt.",
        "content": "Content of the post.",
        "status": Post.Status.PUBLISHED,
    }
    defaults.update(kwargs)
    return Post.objects.create(author=author, category=category, **defaults)


class CategorySerializerTest(TestCase):
    def test_serializes_category(self):
        cat = make_category(name="Python", slug="python")
        data = CategorySerializer(cat).data
        self.assertEqual(data["name"], "Python")
        self.assertEqual(data["slug"], "python")

    def test_contains_expected_fields(self):
        cat = make_category()
        data = CategorySerializer(cat).data
        self.assertIn("id", data)
        self.assertIn("name", data)
        self.assertIn("slug", data)


class TagSerializerTest(TestCase):
    def test_serializes_tag(self):
        tag = Tag.objects.create(name="django", slug="django")
        data = TagSerializer(tag).data
        self.assertEqual(data["name"], "django")
        self.assertEqual(data["slug"], "django")


class PostListSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()
        self.post = make_post(self.user, self.category)

    def test_serializes_post_list(self):
        data = PostListSerializer(self.post).data
        self.assertEqual(data["title"], "Test Post")
        self.assertEqual(data["slug"], "test-post")
        self.assertEqual(data["status"], "published")

    def test_contains_author_name(self):
        self.user.display_name = "Author Display"
        self.user.save()
        self.post.refresh_from_db()
        data = PostListSerializer(self.post).data
        self.assertEqual(data["author_name"], "Author Display")

    def test_contains_category_name(self):
        data = PostListSerializer(self.post).data
        self.assertEqual(data["category_name"], "Tech")

    def test_tags_list(self):
        tag = Tag.objects.create(name="python", slug="python")
        self.post.tags.add(tag)
        data = PostListSerializer(self.post).data
        self.assertIn("python", data["tags"])
        self.assertIn("python", data["tag_slugs"])

    def test_no_image_returns_none(self):
        data = PostListSerializer(self.post).data
        self.assertIsNone(data["image"])

    def test_read_time_minutes_included(self):
        data = PostListSerializer(self.post).data
        self.assertGreaterEqual(data["read_time_minutes"], 1)

    def test_post_without_category(self):
        post = make_post(self.user, None, slug="no-cat", title="No Category")
        data = PostListSerializer(post).data
        self.assertIsNone(data["category_name"])
        self.assertIsNone(data["category_slug"])
        self.assertIsNone(data["category_id"])


class PostDetailSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()
        self.post = make_post(self.user, self.category)
        self.factory = RequestFactory()

    def test_contains_content(self):
        data = PostDetailSerializer(self.post).data
        self.assertIn("content", data)
        self.assertEqual(data["content"], "Content of the post.")

    def test_contains_meta_fields(self):
        self.post.meta_title = "SEO Title"
        self.post.meta_description = "SEO desc"
        self.post.save()
        data = PostDetailSerializer(self.post).data
        self.assertEqual(data["meta_title"], "SEO Title")
        self.assertEqual(data["meta_description"], "SEO desc")

    def test_category_nested(self):
        data = PostDetailSerializer(self.post).data
        self.assertIsInstance(data["category"], dict)
        self.assertEqual(data["category"]["name"], "Tech")

    def test_author_email_hidden_without_staff(self):
        request = self.factory.get("/")
        request.user = self.user
        data = PostDetailSerializer(self.post, context={"request": request}).data
        self.assertNotIn("author_email", data)


class PublicPostDetailSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.post = make_post(self.user, make_category())

    def test_does_not_expose_status(self):
        data = PublicPostDetailSerializer(self.post).data
        self.assertNotIn("status", data)

    def test_contains_author_username(self):
        self.user.username = "publicuser"
        self.user.save()
        data = PublicPostDetailSerializer(self.post).data
        self.assertEqual(data["author_username"], "publicuser")


class CommentListSerializerTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.post = make_post(self.user, make_category())

    def test_author_name_from_user(self):
        from apps.blog.models import Comment
        self.user.display_name = "Display Author"
        self.user.save()
        comment = Comment.objects.create(post=self.post, author=self.user, content="Test")
        data = CommentListSerializer(comment).data
        self.assertEqual(data["author_name"], "Display Author")

    def test_author_name_from_name_field(self):
        from apps.blog.models import Comment
        comment = Comment.objects.create(post=self.post, name="Guest User", content="Guest comment")
        data = CommentListSerializer(comment).data
        self.assertEqual(data["author_name"], "Guest User")

    def test_reply_count(self):
        from apps.blog.models import Comment
        parent = Comment.objects.create(
            post=self.post, author=self.user, content="Parent", is_approved=True, is_public=True
        )
        Comment.objects.create(
            post=self.post, author=self.user, content="Reply", parent=parent,
            is_approved=True, is_public=True
        )
        data = CommentListSerializer(parent).data
        self.assertEqual(data["reply_count"], 1)
