"""
Tests for the publish_scheduled management command.
"""
from io import StringIO
from datetime import timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.blog.models import Post


def _make_user():
    return User.objects.create_user(
        email="sched@example.com",
        username="sched",
        password="Pass1234!",
    )


def _make_post(author, status, published_at=None, slug="sched-post"):
    return Post.objects.create(
        title="Scheduled Post",
        slug=slug,
        excerpt="Excerpt",
        content="<p>Content</p>",
        author=author,
        status=status,
        is_public=True,
        published_at=published_at,
    )


class PublishScheduledCommandTestCase(TestCase):
    def setUp(self):
        self.user = _make_user()

    def test_publishes_overdue_scheduled_post(self):
        past = timezone.now() - timedelta(minutes=5)
        post = _make_post(self.user, Post.Status.SCHEDULED, published_at=past)

        call_command("publish_scheduled", stdout=StringIO())

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PUBLISHED)

    def test_does_not_publish_future_post(self):
        future = timezone.now() + timedelta(hours=2)
        post = _make_post(self.user, Post.Status.SCHEDULED, published_at=future, slug="future-post")

        call_command("publish_scheduled", stdout=StringIO())

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.SCHEDULED)

    def test_does_not_touch_draft_posts(self):
        post = _make_post(self.user, Post.Status.DRAFT, slug="draft-post")

        call_command("publish_scheduled", stdout=StringIO())

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.DRAFT)

    def test_dry_run_does_not_publish(self):
        past = timezone.now() - timedelta(minutes=5)
        post = _make_post(self.user, Post.Status.SCHEDULED, published_at=past, slug="dry-post")

        out = StringIO()
        call_command("publish_scheduled", "--dry-run", stdout=out)

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.SCHEDULED)
        self.assertIn("dry-run", out.getvalue())

    def test_idempotent_on_already_published(self):
        """Running the command twice must not fail or alter a published post."""
        past = timezone.now() - timedelta(minutes=5)
        post = _make_post(self.user, Post.Status.SCHEDULED, published_at=past, slug="idem-post")

        call_command("publish_scheduled", stdout=StringIO())
        call_command("publish_scheduled", stdout=StringIO())

        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PUBLISHED)

    def test_no_posts_outputs_expected_message(self):
        out = StringIO()
        call_command("publish_scheduled", stdout=out)
        self.assertIn("No scheduled posts", out.getvalue())
