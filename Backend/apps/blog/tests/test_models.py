"""
Tests for blog models.
"""
from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.blog.models import Category, Comment, Post, PostRevision, Tag


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
        "status": Post.Status.DRAFT,
    }
    defaults.update(kwargs)
    return Post.objects.create(author=author, category=category, **defaults)


class CategoryModelTest(TestCase):
    def test_str(self):
        cat = make_category(name="News", slug="news")
        self.assertEqual(str(cat), "News")

    def test_default_active(self):
        cat = make_category()
        self.assertTrue(cat.is_active)

    def test_ordering(self):
        make_category(name="Z Cat", slug="z-cat", display_order=10)
        make_category(name="A Cat", slug="a-cat", display_order=1)
        cats = list(Category.objects.values_list("name", flat=True))
        self.assertEqual(cats[0], "A Cat")


class TagModelTest(TestCase):
    def test_create_tag(self):
        tag = Tag.objects.create(name="django", slug="django")
        self.assertEqual(str(tag), "django")

    def test_unique_slug(self):
        Tag.objects.create(name="Python", slug="python")
        with self.assertRaises(Exception):
            Tag.objects.create(name="Python2", slug="python")


class PostModelTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.category = make_category()

    def test_create_post_default_draft(self):
        post = make_post(self.user, self.category)
        self.assertEqual(post.status, Post.Status.DRAFT)
        self.assertEqual(post.view_count, 0)

    def test_publish(self):
        post = make_post(self.user, self.category)
        post.publish()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PUBLISHED)
        self.assertIsNotNone(post.published_at)
        self.assertEqual(post.rejection_reason, "")

    def test_archive(self):
        post = make_post(self.user, self.category, status=Post.Status.PUBLISHED)
        post.archive()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.ARCHIVED)

    def test_unpublish(self):
        post = make_post(self.user, self.category, status=Post.Status.PUBLISHED)
        post.published_at = timezone.now()
        post.save()
        post.unpublish()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.DRAFT)
        self.assertIsNone(post.published_at)

    def test_submit_for_review(self):
        post = make_post(self.user, self.category)
        post.submit_for_review()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PENDING)

    def test_reject(self):
        post = make_post(self.user, self.category, status=Post.Status.PENDING)
        post.reject(reason="Conteúdo inadequado")
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.REJECTED)
        self.assertEqual(post.rejection_reason, "Conteúdo inadequado")

    def test_schedule(self):
        post = make_post(self.user, self.category)
        future = timezone.now() + timezone.timedelta(days=1)
        post.schedule(future)
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.SCHEDULED)
        self.assertEqual(post.published_at, future)

    def test_increment_view(self):
        post = make_post(self.user, self.category)
        post.increment_view()
        post.refresh_from_db()
        self.assertEqual(post.view_count, 1)

    def test_is_published_property(self):
        post = make_post(self.user, self.category)
        self.assertFalse(post.is_published)
        post.publish()
        self.assertTrue(post.is_published)

    def test_read_time_minutes_minimum_one(self):
        post = make_post(self.user, self.category, content="Short")
        self.assertEqual(post.read_time_minutes, 1)

    def test_read_time_minutes_calculation(self):
        # 200 words = 1 min, 400 words = 2 min
        words = " ".join(["word"] * 400)
        post = make_post(self.user, self.category, content=words)
        self.assertEqual(post.read_time_minutes, 2)

    def test_str(self):
        post = make_post(self.user, self.category, title="My Title")
        self.assertEqual(str(post), "My Title")

    def test_unique_slug(self):
        make_post(self.user, self.category, slug="unique-slug")
        with self.assertRaises(Exception):
            make_post(self.user, self.category, slug="unique-slug")

    def test_tags_many_to_many(self):
        tag1 = Tag.objects.create(name="python", slug="python")
        tag2 = Tag.objects.create(name="django", slug="django")
        post = make_post(self.user, self.category)
        post.tags.add(tag1, tag2)
        self.assertEqual(post.tags.count(), 2)


class CommentModelTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.post = make_post(self.user, make_category())

    def test_create_comment_unapproved_by_default(self):
        comment = Comment.objects.create(
            post=self.post,
            author=self.user,
            content="Great post!",
        )
        self.assertFalse(comment.is_approved)
        self.assertTrue(comment.is_public)

    def test_anonymous_comment(self):
        comment = Comment.objects.create(
            post=self.post,
            name="Anonymous",
            email="anon@example.com",
            content="Anonymous comment",
        )
        self.assertIsNone(comment.author)
        self.assertEqual(comment.name, "Anonymous")

    def test_nested_comment(self):
        parent = Comment.objects.create(post=self.post, author=self.user, content="Parent")
        child = Comment.objects.create(post=self.post, author=self.user, content="Child", parent=parent)
        self.assertEqual(child.parent, parent)
        self.assertEqual(parent.replies.count(), 1)


class PostRevisionModelTest(TestCase):
    def setUp(self):
        self.user = make_user()
        self.post = make_post(self.user, make_category())

    def test_create_revision(self):
        revision = PostRevision.objects.create(
            post=self.post,
            user=self.user,
            data={"title": "Old Title", "content": "Old content", "excerpt": "", "status": "draft"},
            comment="Initial revision",
        )
        self.assertEqual(revision.post, self.post)
        self.assertEqual(revision.data["title"], "Old Title")

    def test_revisions_ordered_by_newest(self):
        PostRevision.objects.create(post=self.post, user=self.user, data={"v": 1})
        PostRevision.objects.create(post=self.post, user=self.user, data={"v": 2})
        revisions = list(PostRevision.objects.filter(post=self.post))
        self.assertEqual(revisions[0].data["v"], 2)
