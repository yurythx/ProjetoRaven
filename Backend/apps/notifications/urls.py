from django.urls import path
from .views import NotificationListView, UnreadCountView, MarkAllReadView, MarkReadView

app_name = "notifications"

urlpatterns = [
    path("", NotificationListView.as_view(), name="list"),
    path("unread-count/", UnreadCountView.as_view(), name="unread_count"),
    path("mark-all-read/", MarkAllReadView.as_view(), name="mark_all_read"),
    path("<uuid:pk>/read/", MarkReadView.as_view(), name="mark_read"),
]
