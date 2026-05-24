from .api.categories import ForumCategoryViewSet, PublicForumCategoryViewSet
from .api.topics import TopicViewSet
from .api.replies import ReplyViewSet

# Map public viewsets to the main ones as they handle public access internally
PublicTopicViewSet = TopicViewSet
PublicReplyViewSet = ReplyViewSet

__all__ = [
    "ForumCategoryViewSet",
    "PublicForumCategoryViewSet",
    "TopicViewSet",
    "PublicTopicViewSet",
    "ReplyViewSet",
    "PublicReplyViewSet",
]
