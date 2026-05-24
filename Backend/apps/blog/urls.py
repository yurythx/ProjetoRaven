"""
URL routes for blog app.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.posts.viewset import PostViewSet
from .api.posts.public import PublicPostViewSet
from .api.comments.viewset import CommentViewSet
from .api.tags import TagViewSet, PublicTagViewSet
from .api.categories import CategoryViewSet, PublicCategoryViewSet
from .api.media_images import MediaImageViewSet
from .feeds import LatestPostsFeed, LatestPostsAtomFeed

app_name = "blog"

router = DefaultRouter()
# Admin/Editor API
router.register(r"posts", PostViewSet, basename="post")
router.register(r"articles", PostViewSet, basename="article")
router.register(r"tags", TagViewSet, basename="tag")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"comments", CommentViewSet, basename="comment")
router.register(r"media/images", MediaImageViewSet, basename="media-image")

# Public API
router.register(r"public/posts", PublicPostViewSet, basename="public-post")
router.register(r"public/tags", PublicTagViewSet, basename="public-tag")
router.register(r"public/categories", PublicCategoryViewSet, basename="public-category")
router.register(r"public/comments", CommentViewSet, basename="public-comment")

urlpatterns = [
    path("posts/featured/", PublicPostViewSet.as_view({"get": "featured"}), name="featured-compat"),
    path("posts/search/", PublicPostViewSet.as_view({"get": "search"}), name="search-compat"),
    path("rss/", LatestPostsFeed(), name="rss-feed"),
    path("atom/", LatestPostsAtomFeed(), name="atom-feed"),
    path("", include(router.urls)),
]
