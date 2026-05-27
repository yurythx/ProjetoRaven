"""
Tests for the blog post state machine.

Transitions covered:
  draft → pending (submit_for_review)
  pending → published (publish)
  pending → rejected (reject)
  draft → scheduled (schedule)
  published → archived (archive)
  archived → published (republish via service)
  draft → published (direct, via service)
"""
from django.utils import timezone
from django.test import TestCase

from apps.accounts.models import User
from apps.blog.models import Post
from apps.blog.services.post import PostService
from apps.blog.repositories.post import DjangoPostRepository
from apps.blog.repositories.tag import DjangoTagRepository


def _make_user(suffix="sm"):
    return User.objects.create_user(
        email=f"u_{suffix}@example.com",
        username=f"u_{suffix}",
        password="Pass1234!",
    )


def _make_post(author, **kwargs):
    defaults = dict(
        title="Test Post",
        slug=f"test-post-{id(author)}",
        excerpt="A short excerpt.",
        content="<p>Content here.</p>",
        status=Post.Status.DRAFT,
        is_public=True,
    )
    defaults.update(kwargs)
    return Post.objects.create(author=author, **defaults)


class PostModelTransitionsTestCase(TestCase):
    """Tests for model-level state transition methods."""

    def setUp(self):
        self.user = _make_user()

    def test_submit_for_review(self):
        post = _make_post(self.user)
        post.submit_for_review()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PENDING)

    def test_publish_sets_published_at(self):
        post = _make_post(self.user, status=Post.Status.PENDING)
        post.publish()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PUBLISHED)
        self.assertIsNotNone(post.published_at)

    def test_reject(self):
        post = _make_post(self.user, status=Post.Status.PENDING)
        post.reject(reason="Precisa de revisão.")
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.REJECTED)
        self.assertEqual(post.rejection_reason, "Precisa de revisão.")

    def test_archive_published_post(self):
        post = _make_post(self.user)
        post.publish()
        post.archive()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.ARCHIVED)

    def test_schedule_sets_status_and_published_at(self):
        future = timezone.now() + timezone.timedelta(days=1)
        post = _make_post(self.user)
        post.schedule(when=future)
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.SCHEDULED)
        self.assertIsNotNone(post.published_at)


class PostServiceTransitionsTestCase(TestCase):
    """Tests for service-level publishing transitions."""

    def setUp(self):
        self.user = _make_user("svc")
        self.service = PostService(DjangoPostRepository(), DjangoTagRepository())

    def test_update_to_published_sets_published_at(self):
        post = _make_post(self.user)
        self.assertIsNone(post.published_at)

        self.service.update_post(post, {"status": Post.Status.PUBLISHED}, user=self.user)
        post.refresh_from_db()

        self.assertEqual(post.status, Post.Status.PUBLISHED)
        self.assertIsNotNone(post.published_at)

    def test_update_to_draft_clears_published_at(self):
        post = _make_post(self.user)
        post.publish()
        post.refresh_from_db()
        self.assertIsNotNone(post.published_at)

        self.service.update_post(post, {"status": Post.Status.DRAFT}, user=self.user)
        post.refresh_from_db()

        self.assertEqual(post.status, Post.Status.DRAFT)
        self.assertIsNone(post.published_at)

    def test_update_creates_revision(self):
        from apps.blog.models import PostRevision

        post = _make_post(self.user, slug="rev-post")
        self.service.update_post(post, {"title": "Updated Title"}, user=self.user)

        revisions = PostRevision.objects.filter(post=post)
        self.assertEqual(revisions.count(), 1)
        self.assertEqual(revisions.first().data["title"], "Test Post")

    def test_delete_post(self):
        post = _make_post(self.user, slug="del-post")
        post_id = post.id
        self.service.delete_post(post)
        self.assertFalse(Post.objects.filter(id=post_id).exists())


class PostSelectorTestCase(TestCase):
    """Tests for the read-only PostSelector layer."""

    def setUp(self):
        self.user = _make_user("sel")

    def test_get_published_returns_only_published_public(self):
        from apps.blog.selectors.post import PostSelector

        _make_post(self.user, slug="pub", status=Post.Status.PUBLISHED)
        _make_post(self.user, slug="draft")
        _make_post(self.user, slug="priv", status=Post.Status.PUBLISHED, is_public=False)

        result = PostSelector.get_published()
        slugs = list(result.values_list("slug", flat=True))
        self.assertIn("pub", slugs)
        self.assertNotIn("draft", slugs)
        self.assertNotIn("priv", slugs)

    def test_get_pending_review(self):
        from apps.blog.selectors.post import PostSelector

        _make_post(self.user, slug="pend", status=Post.Status.PENDING)
        _make_post(self.user, slug="draft2")

        result = PostSelector.get_pending_review()
        self.assertEqual(result.count(), 1)
        self.assertEqual(result.first().slug, "pend")

    def test_get_by_slug_returns_none_for_draft(self):
        from apps.blog.selectors.post import PostSelector

        _make_post(self.user, slug="hidden-draft")
        self.assertIsNone(PostSelector.get_by_slug("hidden-draft"))

    def test_get_by_slug_returns_post_when_published(self):
        from apps.blog.selectors.post import PostSelector

        post = _make_post(self.user, slug="visible")
        post.publish()

        found = PostSelector.get_by_slug("visible")
        self.assertIsNotNone(found)
        self.assertEqual(found.slug, "visible")
