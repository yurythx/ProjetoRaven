"""
Models for forum app.
Supports denormalization (reply count) for scale.
"""
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from django.db.models import F
from django.utils import timezone

from apps.common.models import UUIDModel


class ForumCategory(UUIDModel):
    """Forum category with denormalized counters."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    icon = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    topic_count = models.IntegerField(default=0)
    reply_count = models.IntegerField(default=0)

    class Meta:
        db_table = "forum_categories"
        verbose_name = "Forum Category"
        verbose_name_plural = "Forum Categories"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name

    def increment_topic_count(self):
        self.topic_count = models.F("topic_count") + 1
        self.save(update_fields=["topic_count", "updated_at"])

    def decrement_topic_count(self):
        self.topic_count = models.F("topic_count") - 1
        self.save(update_fields=["topic_count", "updated_at"])

    def increment_reply_count(self):
        self.reply_count = models.F("reply_count") + 1
        self.save(update_fields=["reply_count", "updated_at"])

    def decrement_reply_count(self):
        self.reply_count = models.F("reply_count") - 1
        self.save(update_fields=["reply_count", "updated_at"])


class Topic(UUIDModel):
    """Forum topic with denormalized counters."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"
        ARCHIVED = "archived", "Archived"

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)

    content = models.TextField()
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="forum_topics"
    )
    category = models.ForeignKey(
        ForumCategory,
        on_delete=models.CASCADE,
        related_name="topics"
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN
    )

    reply_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)

    last_reply_at = models.DateTimeField(null=True, blank=True)
    last_reply_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="last_replies"
    )

    is_pinned = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)

    search_vector = SearchVectorField(null=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "forum_topics"
        verbose_name = "Topic"
        verbose_name_plural = "Topics"
        ordering = ["-is_pinned", "-last_reply_at"]
        indexes = [
            models.Index(fields=["-last_reply_at"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["-reply_count"]),
            models.Index(fields=["status", "-last_reply_at"]),
            # cobre listagem por categoria ordenada por pinned + recência
            models.Index(fields=["category", "-is_pinned", "-last_reply_at"]),
        ]

    def __str__(self):
        return self.title

    def increment_reply_count(self, reply_author=None):
        self.reply_count = models.F("reply_count") + 1
        self.last_reply_at = timezone.now()
        self.last_reply_by = reply_author
        self.save(update_fields=["reply_count", "last_reply_at", "last_reply_by", "updated_at"])

    def decrement_reply_count(self):
        self.reply_count = models.F("reply_count") - 1
        self.save(update_fields=["reply_count", "updated_at"])

    def increment_view_count(self):
        Topic.objects.filter(id=self.id).update(view_count=F("view_count") + 1)

    def close(self):
        self.status = self.Status.CLOSED
        self.is_locked = True
        self.save(update_fields=["status", "is_locked", "updated_at"])

    def open(self):
        self.status = self.Status.OPEN
        self.is_locked = False
        self.save(update_fields=["status", "is_locked", "updated_at"])

    def archive(self):
        self.status = self.Status.ARCHIVED
        self.is_locked = True
        self.save(update_fields=["status", "is_locked", "updated_at"])

    def pin(self):
        self.is_pinned = True
        self.save(update_fields=["is_pinned", "updated_at"])

    def unpin(self):
        self.is_pinned = False
        self.save(update_fields=["is_pinned", "updated_at"])


class Reply(UUIDModel):
    """Forum reply."""

    content = models.TextField()
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="forum_replies"
    )
    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name="replies"
    )

    is_solution = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    hidden_reason = models.TextField(blank=True)

    edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "forum_replies"
        verbose_name = "Reply"
        verbose_name_plural = "Replies"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["topic", "created_at"]),
        ]

    def __str__(self):
        return f"Reply to {self.topic.title}"

    def mark_as_solution(self):
        self.is_solution = True
        self.save(update_fields=["is_solution", "updated_at"])

    def unmark_solution(self):
        self.is_solution = False
        self.save(update_fields=["is_solution", "updated_at"])

    def hide(self, reason: str = ""):
        self.is_hidden = True
        self.hidden_reason = reason
        self.save(update_fields=["is_hidden", "hidden_reason", "updated_at"])

    def unhide(self):
        self.is_hidden = False
        self.hidden_reason = ""
        self.save(update_fields=["is_hidden", "hidden_reason", "updated_at"])


class TopicReaction(UUIDModel):
    """Reactions to topics (likes, etc)."""

    class ReactionType(models.TextChoices):
        LIKE = "like", "Like"
        DISLIKE = "dislike", "Dislike"
        HEART = "heart", "Heart"
        LAUGH = "laugh", "Laugh"
        WOW = "wow", "Wow"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="topic_reactions"
    )
    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name="reactions"
    )
    reaction = models.CharField(
        max_length=20,
        choices=ReactionType.choices
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forum_topic_reactions"
        unique_together = ["user", "topic", "reaction"]

    def __str__(self):
        return f"{self.user} reacted {self.reaction} to {self.topic}"


class ReplyReaction(UUIDModel):
    """Reactions to replies."""

    class ReactionType(models.TextChoices):
        LIKE = "like", "Like"
        DISLIKE = "dislike", "Dislike"
        HEART = "heart", "Heart"
        LAUGH = "laugh", "Laugh"
        WOW = "wow", "Wow"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="reply_reactions"
    )
    reply = models.ForeignKey(
        Reply,
        on_delete=models.CASCADE,
        related_name="reactions"
    )
    reaction = models.CharField(
        max_length=20,
        choices=ReactionType.choices
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forum_reply_reactions"
        unique_together = ["user", "reply", "reaction"]

    def __str__(self):
        return f"{self.user} reacted {self.reaction} to {self.reply}"
