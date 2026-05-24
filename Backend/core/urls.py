"""
URL configuration for Projeto Raven project.
"""
from django.contrib import admin
from django.conf import settings
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

v1_urlpatterns = [
    path("accounts/", include("apps.accounts.urls")),
    path("blog/", include("apps.blog.urls")),
    path("forum/", include("apps.forum.urls")),
    path("media/", include("apps.media.urls")),
    path("search/", include("apps.common.search_urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", include("apps.common.urls")),
    path("api/v1/", include((v1_urlpatterns, "v1"))),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
