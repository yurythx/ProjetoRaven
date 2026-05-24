"""
Tests for blog API views.
"""
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blog.models import Category, Comment, Post, Tag


def make_user(email="u@test.com", username="testuser", is_staff=False, **kwargs):
    Group.objects.get_or_create(name="players")
    Group.objects.get_or_create(name="blog_editors")
    user = User.objects.create_user(
        email=email, username=username, password="Pass123!",
        is_staff=is_staff, is_verified=True, **kwargs
    )
    return user


def make_editor(email="editor@test.com", username="editor"):
    Group.objects.get_or_create(name="blog_editors")
    user = make_user(email=email, username=username)
    group = Group.objects.get(name="blog_editors")
    user.groups.add(group)
    return user


def make_category(**kwargs):
    defaults = {"name": "Tech", "slug": "tech"}
    defaults.update(kwargs)
    return Category.objects.create(**defaults)


def make_post(author, category=None, status=Post.Status.PUBLISHED, is_public=True, **kwargs):
    defaults = {
        "title": "Test Post",
        "slug": "test-post",
        "excerpt": "Short excerpt.",
        "content": "Content of the post.",
        "status": status,
        "is_public": is_public,
    }
    defaults.update(kwargs)
    return Post.objects.create(author=author, category=category, **defaults)


class PublicPostViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.category = make_category()
        self.published_post = make_post(
            self.user, self.category, slug="pub-post", title="Published Post"
        )
        self.draft_post = make_post(
            self.user, self.category,
            status=Post.Status.DRAFT, slug="draft-post", title="Draft Post"
        )
        self.private_post = make_post(
            self.user, self.category,
            slug="private-post", title="Private Post", is_public=False
        )

    def test_list_public_published_posts(self):
        response = self.client.get("/api/v1/blog/public/posts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p["slug"] for p in response.data["results"]]
        self.assertIn("pub-post", slugs)

    def test_draft_not_in_public_list(self):
        response = self.client.get("/api/v1/blog/public/posts/")
        slugs = [p["slug"] for p in response.data["results"]]
        self.assertNotIn("draft-post", slugs)

    def test_private_post_not_in_public_list(self):
        response = self.client.get("/api/v1/blog/public/posts/")
        slugs = [p["slug"] for p in response.data["results"]]
        self.assertNotIn("private-post", slugs)

    def test_retrieve_published_public_post(self):
        response = self.client.get(f"/api/v1/blog/public/posts/{self.published_post.slug}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], "pub-post")

    def test_retrieve_increments_view_count(self):
        initial_views = self.published_post.view_count
        self.client.get(f"/api/v1/blog/public/posts/{self.published_post.slug}/")
        self.published_post.refresh_from_db()
        self.assertEqual(self.published_post.view_count, initial_views + 1)

    def test_retrieve_draft_returns_404(self):
        response = self.client.get(f"/api/v1/blog/public/posts/{self.draft_post.slug}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_filter_by_category(self):
        other_cat = make_category(name="Other", slug="other")
        make_post(self.user, other_cat, slug="other-post", title="Other Post")
        response = self.client.get("/api/v1/blog/public/posts/", {"category": "tech"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for post in response.data["results"]:
            self.assertEqual(post["category_slug"], "tech")

    def test_featured_action(self):
        self.published_post.is_featured = True
        self.published_post.save()
        response = self.client.get("/api/v1/blog/public/posts/featured/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p["slug"] for p in response.data]
        self.assertIn("pub-post", slugs)

    def test_search_by_title(self):
        make_post(self.user, self.category, slug="findme", title="Unique Findable Title")
        response = self.client.get("/api/v1/blog/public/posts/", {"q": "Unique Findable"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p["slug"] for p in response.data["results"]]
        self.assertIn("findme", slugs)


class PostViewSetEditorTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.editor = make_editor()
        self.client.force_authenticate(user=self.editor)
        self.category = make_category()

    def test_editor_can_list_all_statuses(self):
        make_post(self.editor, self.category, slug="draft1", status=Post.Status.DRAFT)
        make_post(self.editor, self.category, slug="pub1", status=Post.Status.PUBLISHED)
        response = self.client.get("/api/v1/blog/posts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p["slug"] for p in response.data["results"]]
        self.assertIn("draft1", slugs)
        self.assertIn("pub1", slugs)

    def test_editor_can_create_post(self):
        response = self.client.post("/api/v1/blog/posts/", {
            "title": "New Post",
            "content": "Some content here for testing purposes.",
            "excerpt": "Brief excerpt",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_editor_can_publish_post(self):
        post = make_post(self.editor, self.category, slug="to-publish", status=Post.Status.DRAFT)
        response = self.client.post(f"/api/v1/blog/posts/{post.slug}/publish/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.PUBLISHED)

    def test_editor_can_archive_post(self):
        post = make_post(self.editor, self.category, slug="to-archive", status=Post.Status.PUBLISHED)
        response = self.client.post(f"/api/v1/blog/posts/{post.slug}/archive/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.ARCHIVED)

    def test_editor_can_reject_post(self):
        post = make_post(self.editor, self.category, slug="to-reject", status=Post.Status.PENDING)
        response = self.client.post(
            f"/api/v1/blog/posts/{post.slug}/reject/",
            {"reason": "Content policy violation"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.REJECTED)
        self.assertEqual(post.rejection_reason, "Content policy violation")

    def test_analytics_action(self):
        make_post(self.editor, self.category, slug="analyt1", status=Post.Status.PUBLISHED)
        response = self.client.get("/api/v1/blog/posts/analytics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_articles", response.data)
        self.assertIn("total_views", response.data)

    def test_history_action(self):
        from apps.blog.models import PostRevision
        post = make_post(self.editor, self.category, slug="hist-post")
        PostRevision.objects.create(
            post=post, user=self.editor,
            data={"title": "Old", "content": "c", "excerpt": "e", "status": "draft"}
        )
        response = self.client.get(f"/api/v1/blog/posts/{post.slug}/history/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class PostViewSetUnauthenticatedTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.category = make_category()

    def test_anonymous_cannot_create_post(self):
        response = self.client.post("/api/v1/blog/posts/", {
            "title": "Attempt",
            "content": "content",
            "excerpt": "e",
        }, format="json")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_anonymous_can_list_published_posts(self):
        make_post(self.user, self.category, slug="anon-pub", status=Post.Status.PUBLISHED)
        response = self.client.get("/api/v1/blog/posts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p["slug"] for p in response.data["results"]]
        self.assertIn("anon-pub", slugs)


class CommentViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.editor = make_editor()
        self.category = make_category()
        self.post = make_post(self.user, self.category, slug="comment-post")

    def test_anonymous_can_create_comment(self):
        response = self.client.post("/api/v1/blog/public/comments/", {
            "post": str(self.post.id),
            "content": "This is a comment",
            "name": "Anonymous",
            "email": "anon@test.com",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["is_approved"])

    def test_authenticated_comment_sets_author(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/v1/blog/public/comments/", {
            "post": str(self.post.id),
            "content": "Auth comment",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        comment = Comment.objects.get(id=response.data["id"])
        self.assertEqual(comment.author, self.user)

    def test_list_comments_requires_post_param(self):
        response = self.client.get("/api/v1/blog/public/comments/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_comments_for_post(self):
        Comment.objects.create(
            post=self.post, author=self.user,
            content="Approved comment", is_approved=True
        )
        Comment.objects.create(
            post=self.post, author=self.user,
            content="Unapproved comment", is_approved=False
        )
        response = self.client.get(
            "/api/v1/blog/public/comments/",
            {"post_slug": self.post.slug}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        contents = [c["content"] for c in response.data["results"]]
        self.assertIn("Approved comment", contents)
        self.assertNotIn("Unapproved comment", contents)

    def test_editor_can_approve_comment(self):
        self.client.force_authenticate(user=self.editor)
        comment = Comment.objects.create(
            post=self.post, author=self.user, content="Pending", is_approved=False
        )
        response = self.client.post(f"/api/v1/blog/comments/{comment.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        comment.refresh_from_db()
        self.assertTrue(comment.is_approved)

    def test_editor_can_list_pending_comments(self):
        self.client.force_authenticate(user=self.editor)
        Comment.objects.create(post=self.post, author=self.user, content="Pending", is_approved=False)
        response = self.client.get("/api/v1/blog/comments/pending/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_non_editor_cannot_approve(self):
        self.client.force_authenticate(user=self.user)
        comment = Comment.objects.create(
            post=self.post, author=self.user, content="Pending", is_approved=False
        )
        response = self.client.post(f"/api/v1/blog/comments/{comment.id}/approve/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_editor_can_delete_comment(self):
        self.client.force_authenticate(user=self.editor)
        comment = Comment.objects.create(post=self.post, author=self.user, content="To delete")
        response = self.client.delete(f"/api/v1/blog/comments/{comment.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Comment.objects.filter(id=comment.id).exists())
