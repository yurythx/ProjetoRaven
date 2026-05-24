from django.test import TestCase

from apps.accounts.models import User
from apps.blog.models import Post
from apps.blog.services.post import PostService
from apps.blog.repositories.post import DjangoPostRepository
from apps.blog.repositories.tag import DjangoTagRepository


class PostServiceWorkflowTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="author@example.com",
            password="Pass1234!",
            username="author",
        )
        self.post_repo = DjangoPostRepository()
        self.tag_repo = DjangoTagRepository()
        self.service = PostService(self.post_repo, self.tag_repo)

    def test_update_post_sets_published_at_when_publishing(self):
        post = Post.objects.create(
            title="Draft",
            slug="draft",
            excerpt="excerpt",
            content="<p>content</p>",
            author=self.user,
            status=Post.Status.DRAFT,
            is_public=True,
        )
        self.assertIsNone(post.published_at)

        self.service.update_post(
            post,
            {"status": Post.Status.PUBLISHED},
            user=self.user,
        )
        post.refresh_from_db()

        self.assertEqual(post.status, Post.Status.PUBLISHED)
        self.assertIsNotNone(post.published_at)

    def test_update_post_clears_published_at_when_unpublishing(self):
        post = Post.objects.create(
            title="Published",
            slug="published",
            excerpt="excerpt",
            content="<p>content</p>",
            author=self.user,
            status=Post.Status.DRAFT,
            is_public=True,
        )
        post.publish()
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PUBLISHED)
        self.assertIsNotNone(post.published_at)

        self.service.update_post(
            post,
            {"status": Post.Status.DRAFT},
            user=self.user,
        )
        post.refresh_from_db()

        self.assertEqual(post.status, Post.Status.DRAFT)
        self.assertIsNone(post.published_at)
