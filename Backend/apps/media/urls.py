from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api import MediaFileViewSet

app_name = "media"

router = DefaultRouter()
router.register(r"files", MediaFileViewSet, basename="media-file")

urlpatterns = [
    path("", include(router.urls)),
]
