from django.contrib import admin
from .models import MediaFile


@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = ["id", "original_filename", "uploaded_by", "created_at"]
    list_filter = ["created_at", "uploaded_by"]
    search_fields = ["original_filename", "alt_text"]
    readonly_fields = ["id", "created_at", "uploaded_by"]
