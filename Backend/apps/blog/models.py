"""
Models for blog app.
News and updates - focused on reading via Next.js ISR.
"""
from django.db import models
from django.db.models import F
from django.utils import timezone

from apps.common.models import UUIDModel


class Category(UUIDModel):
    """Blog post category."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "blog_categories"
        verbose_name = "Category"
        verbose_name_plural = "Categories"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class Tag(UUIDModel):
    """Blog post tags."""

    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "blog_tags"
        verbose_name = "Tag"
        verbose_name_plural = "Tags"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Post(UUIDModel):
    """Blog post with publishing workflow."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending Review"
        REJECTED = "rejected", "Rejected"
        SCHEDULED = "scheduled", "Scheduled"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=200)

    excerpt = models.TextField(max_length=500)
    content = models.TextField()

    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="blog_posts"
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posts"
    )
    tags = models.ManyToManyField(
        Tag,
        blank=True,
        related_name="posts"
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )
    rejection_reason = models.TextField(blank=True)

    is_public = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Se false, apenas usuários autenticados podem ver."
    )
    is_featured = models.BooleanField(default=False)

    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    image = models.ImageField(upload_to="blog/posts", null=True, blank=True)

    view_count = models.IntegerField(default=0)

    meta_title = models.CharField(max_length=70, blank=True)
    meta_description = models.CharField(max_length=160, blank=True)
    meta_keywords = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "blog_posts"
        verbose_name = "Post"
        verbose_name_plural = "Posts"
        ordering = ["-published_at", "-created_at"]
        indexes = [
            models.Index(fields=["-published_at"]),
            models.Index(fields=["-created_at"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["status", "-published_at"]),
        ]

    def __str__(self):
        return self.title

    def publish(self):
        """Publish the post."""
        self.status = self.Status.PUBLISHED
        self.published_at = timezone.now()
        self.rejection_reason = ""
        self.save(update_fields=["status", "published_at", "rejection_reason", "updated_at"])

    def archive(self):
        """Archive the post."""
        self.status = self.Status.ARCHIVED
        self.save(update_fields=["status", "updated_at"])

    def unpublish(self):
        """Revert to draft."""
        self.status = self.Status.DRAFT
        self.published_at = None
        self.save(update_fields=["status", "published_at", "updated_at"])

    def submit_for_review(self):
        self.status = self.Status.PENDING
        self.rejection_reason = ""
        self.save(update_fields=["status", "rejection_reason", "updated_at"])

    def reject(self, reason: str = ""):
        self.status = self.Status.REJECTED
        self.rejection_reason = reason
        self.save(update_fields=["status", "rejection_reason", "updated_at"])

    def schedule(self, when):
        self.status = self.Status.SCHEDULED
        self.published_at = when
        self.save(update_fields=["status", "published_at", "updated_at"])

    def increment_view(self):
        """Increment view count."""
        Post.objects.filter(id=self.id).update(view_count=F("view_count") + 1)

    @property
    def is_published(self):
        return self.status == self.Status.PUBLISHED

    @property
    def read_time_minutes(self):
        words = len(self.content.split())
        return max(1, words // 200)


class PostView(UUIDModel):
    post = models.ForeignKey(Post, related_name="views", on_delete=models.CASCADE)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "blog_post_views"
        indexes = [models.Index(fields=["post", "viewed_at"])]


class Comment(UUIDModel):
    post = models.ForeignKey(Post, related_name="comments", on_delete=models.CASCADE)
    parent = models.ForeignKey("self", null=True, blank=True, related_name="replies", on_delete=models.CASCADE)
    author = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    content = models.TextField()
    is_public = models.BooleanField(default=True, db_index=True)
    is_approved = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "blog_comments"
        ordering = ["-created_at"]


class PostRevision(models.Model):
    post = models.ForeignKey(Post, related_name="revisions", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    comment = models.CharField(max_length=255, blank=True)
    data = models.JSONField()

    class Meta:
        db_table = "blog_post_revisions"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["post", "-created_at"])]
