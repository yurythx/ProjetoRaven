from typing import Protocol, List, Optional
from uuid import UUID
from ..models import Reply

class ReplyRepository(Protocol):
    def get_by_id(self, reply_id: UUID) -> Optional[Reply]: ...
    def create(self, **kwargs) -> Reply: ...
    def update(self, reply: Reply, **kwargs) -> Reply: ...
    def delete(self, reply: Reply) -> None: ...
    def list_by_topic(self, topic_id: UUID) -> List[Reply]: ...

class DjangoReplyRepository:
    def get_by_id(self, reply_id: UUID) -> Optional[Reply]:
        return Reply.objects.filter(id=reply_id).select_related("author", "topic").first()

    def create(self, **kwargs) -> Reply:
        return Reply.objects.create(**kwargs)

    def update(self, reply: Reply, **kwargs) -> Reply:
        for key, value in kwargs.items():
            setattr(reply, key, value)
        reply.save()
        return reply

    def delete(self, reply: Reply) -> None:
        reply.delete()

    def list_by_topic(self, topic_id: UUID) -> List[Reply]:
        return list(Reply.objects.filter(topic_id=topic_id).select_related("author").order_by("created_at"))
