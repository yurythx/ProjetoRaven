"""
Admin configuration for forum app.
"""
from django.contrib import admin

from apps.forum.models import (
    ForumCategory,
    Reply,
    ReplyReaction,
    Topic,
    TopicReaction,
)


@admin.register(ForumCategory)
class ForumCategoryAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "slug",
        "display_order",
        "is_active",
        "topic_count",
        "reply_count",
        "created_at",
    ]
    list_filter = ["is_active"]
    search_fields = ["name", "description"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "author",
        "category",
        "status",
        "is_pinned",
        "is_locked",
        "reply_count",
        "view_count",
        "last_reply_at",
        "created_at",
    ]
    list_filter = ["status", "is_pinned", "is_locked", "category"]
    search_fields = ["title", "content"]
    date_hierarchy = "created_at"
    raw_id_fields = ["author", "last_reply_by"]


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "topic",
        "author",
        "is_solution",
        "is_hidden",
        "created_at",
    ]
    list_filter = ["is_solution", "is_hidden"]
    search_fields = ["content"]
    date_hierarchy = "created_at"
    raw_id_fields = ["author"]


@admin.register(TopicReaction)
class TopicReactionAdmin(admin.ModelAdmin):
    list_display = ["user", "topic", "reaction", "created_at"]
    list_filter = ["reaction"]
    date_hierarchy = "created_at"
    raw_id_fields = ["user", "topic"]


@admin.register(ReplyReaction)
class ReplyReactionAdmin(admin.ModelAdmin):
    list_display = ["user", "reply", "reaction", "created_at"]
    list_filter = ["reaction"]
    date_hierarchy = "created_at"
    raw_id_fields = ["user", "reply"]
