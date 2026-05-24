from django.urls import re_path
from .consumers import TopicConsumer

websocket_urlpatterns = [
    re_path(r"^ws/forum/topic/(?P<slug>[a-zA-Z0-9_-]+)/$", TopicConsumer.as_asgi()),
]
