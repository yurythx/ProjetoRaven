from typing import Protocol, List, Optional
from uuid import UUID
from ..models import Topic

class TopicRepository(Protocol):
    def get_by_id(self, topic_id: UUID) -> Optional[Topic]: ...
    def get_by_slug(self, slug: str) -> Optional[Topic]: ...
    def create(self, **kwargs) -> Topic: ...
    def update(self, topic: Topic, **kwargs) -> Topic: ...
    def delete(self, topic: Topic) -> None: ...
    def increment_view_count(self, topic_id: UUID) -> None: ...

class DjangoTopicRepository:
    def get_by_id(self, topic_id: UUID) -> Optional[Topic]:
        return Topic.objects.filter(id=topic_id).select_related("author", "category").first()

    def get_by_slug(self, slug: str) -> Optional[Topic]:
        return Topic.objects.filter(slug=slug).select_related("author", "category").first()

    def create(self, **kwargs) -> Topic:
        return Topic.objects.create(**kwargs)

    def update(self, topic: Topic, **kwargs) -> Topic:
        for key, value in kwargs.items():
            setattr(topic, key, value)
        topic.save()
        return topic

    def delete(self, topic: Topic) -> None:
        topic.delete()

    def increment_view_count(self, topic_id: UUID) -> None:
        from django.db.models import F
        Topic.objects.filter(id=topic_id).update(view_count=F("view_count") + 1)
