"""
URL routes for forum app.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.categories import ForumCategoryViewSet, PublicForumCategoryViewSet
from .api.topics import TopicViewSet
from .api.replies import ReplyViewSet
from .api.reactions import TopicReactionViewSet, ReplyReactionViewSet

app_name = "forum"

router = DefaultRouter()
router.register(r"categories", ForumCategoryViewSet, basename="forum-category")
router.register(r"topics", TopicViewSet, basename="forum-topic")
router.register(r"replies", ReplyViewSet, basename="forum-reply")
router.register(r"public/categories", PublicForumCategoryViewSet, basename="public-forum-category")

# Note: In the new structure, we don't have separate PublicTopicViewSet and PublicReplyViewSet yet
# I will use TopicViewSet and ReplyViewSet which already handle public access in get_permissions
router.register(r"public/topics", TopicViewSet, basename="public-forum-topic")
router.register(r"public/replies", ReplyViewSet, basename="public-forum-reply")

router.register(r"topic-reactions", TopicReactionViewSet, basename="topic-reaction")
router.register(r"reply-reactions", ReplyReactionViewSet, basename="reply-reaction")

urlpatterns = [
    path("", include(router.urls)),
]
