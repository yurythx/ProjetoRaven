from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["recipient", "verb", "actor_name", "read", "created_at"]
    list_filter = ["verb", "read"]
    search_fields = ["recipient__username", "actor_name", "message"]
    ordering = ["-created_at"]
    readonly_fields = ["id", "created_at"]
