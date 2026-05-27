"""
Tests for notification signal helpers and the in-app notification flow.

Covers:
  - notify_forum_reply creates a Notification record
  - notify_forum_reply skips self-reply
  - notify_blog_comment creates a Notification record
  - notify_blog_comment skips self-comment
  - notify_blog_comment triggers Web Push (mocked)
  - CommentService calls notify_blog_comment for approved comments
"""
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import Group
from django.test import TestCase

from apps.accounts.models import User
from apps.blog.models import Post, Comment
from apps.blog.services.comment import CommentService
from apps.blog.repositories.comment import DjangoCommentRepository
from apps.forum.models import ForumCategory, Topic, Reply
from apps.notifications.models import Notification
from apps.notifications.signals import notify_forum_reply, notify_blog_comment


def _make_user(suffix):
    return User.objects.create_user(
        email=f"u_{suffix}@example.com",
        username=f"u_{suffix}",
        password="Pass1234!",
        is_verified=True,
    )


def _make_post(author):
    post = Post.objects.create(
        title="Article",
        slug=f"article-{author.id}",
        excerpt="Excerpt",
        content="<p>body</p>",
        author=author,
        status=Post.Status.PUBLISHED,
        is_public=True,
    )
    return post


class NotifyForumReplyTestCase(TestCase):
    def setUp(self):
        Group.objects.get_or_create(name="members")
        self.author = _make_user("topic_author")
        self.replier = _make_user("replier")
        self.category = ForumCategory.objects.create(
            name="General", slug="general"
        )
        self.topic = Topic.objects.create(
            title="Test Topic",
            slug="test-topic",
            content="Content",
            author=self.author,
            category=self.category,
        )
        self.reply = Reply.objects.create(
            topic=self.topic,
            content="A reply",
            author=self.replier,
        )

    def test_creates_notification_for_topic_author(self):
        notify_forum_reply(self.topic, self.reply)
        notif = Notification.objects.filter(recipient=self.author).first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.verb, "forum_reply")
        self.assertIn(self.replier.username, notif.actor_name)

    def test_skips_self_reply(self):
        self_reply = Reply.objects.create(
            topic=self.topic,
            content="Own reply",
            author=self.author,
        )
        notify_forum_reply(self.topic, self_reply)
        self.assertFalse(Notification.objects.filter(recipient=self.author).exists())

    def test_notification_target_url_contains_topic_slug(self):
        notify_forum_reply(self.topic, self.reply)
        notif = Notification.objects.filter(recipient=self.author).first()
        self.assertIn("test-topic", notif.target_url)


class NotifyBlogCommentTestCase(TestCase):
    def setUp(self):
        self.author = _make_user("blog_author")
        self.commenter = _make_user("commenter")
        self.post = _make_post(self.author)
        self.comment = Comment.objects.create(
            post=self.post,
            author=self.commenter,
            content="Great article!",
            is_approved=True,
            is_public=True,
        )

    def test_creates_notification_for_post_author(self):
        notify_blog_comment(self.post, self.comment)
        notif = Notification.objects.filter(recipient=self.author).first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.verb, "blog_comment")

    def test_skips_self_comment(self):
        self_comment = Comment.objects.create(
            post=self.post,
            author=self.author,
            content="Own comment",
            is_approved=True,
            is_public=True,
        )
        notify_blog_comment(self.post, self_comment)
        self.assertFalse(Notification.objects.filter(recipient=self.author).exists())

    @patch("apps.accounts.services.push.send_push_to_user", return_value=0)
    def test_triggers_web_push(self, mock_push: MagicMock):
        notify_blog_comment(self.post, self.comment)
        mock_push.assert_called_once()
        call_kwargs = mock_push.call_args
        self.assertEqual(call_kwargs[0][0], self.author)

    def test_notification_target_url_contains_post_slug(self):
        notify_blog_comment(self.post, self.comment)
        notif = Notification.objects.filter(recipient=self.author).first()
        self.assertIn(self.post.slug, notif.target_url)


class CommentServiceNotificationTestCase(TestCase):
    """CommentService must call notify_blog_comment for approved (editor) comments."""

    def setUp(self):
        self.author = _make_user("ca")
        # is_staff=True qualifies as editor in CommentService
        self.editor = _make_user("ed")
        self.editor.is_staff = True
        self.editor.is_verified = True
        self.editor.save(update_fields=["is_staff", "is_verified"])
        self.post = _make_post(self.author)
        self.service = CommentService(DjangoCommentRepository())

    def test_editor_comment_creates_notification(self):
        self.service.create_comment(
            author=self.editor,
            content="Nice post!",
            post=self.post,
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.author, verb="blog_comment"
            ).exists()
        )
