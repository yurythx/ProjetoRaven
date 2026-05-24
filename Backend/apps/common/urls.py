from django.urls import path
from django.conf import settings

from apps.common.views import (
    HealthLiveView,
    HealthReadyView,
    HealthDetailedView,
    HealthVersionView,
)

metrics_view = None
if getattr(settings, "METRICS_ENABLED", False):
    try:
        from apps.common.metrics import get_metrics_view
        metrics_view = get_metrics_view()
    except ImportError:
        pass

urlpatterns = [
    path("live/", HealthLiveView.as_view(), name="health_live"),
    path("ready/", HealthReadyView.as_view(), name="health_ready"),
    path("detailed/", HealthDetailedView.as_view(), name="health_detailed"),
    path("version/", HealthVersionView.as_view(), name="health_version"),
]

if metrics_view:
    urlpatterns.append(path("metrics/", metrics_view, name="metrics"))
