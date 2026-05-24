from typing import Protocol, List, Optional
from uuid import UUID
from apps.blog.models import Tag

class TagRepository(Protocol):
    """Abstração de acesso a tags (DIP)."""
    def get_by_slug(self, slug: str) -> Optional[Tag]:
        ...
    def get_or_create(self, name: str, slug: Optional[str] = None) -> Tag:
        ...
    def filter_by_ids(self, ids: List[UUID]) -> List[Tag]:
        ...
    def all(self) -> List[Tag]:
        ...

class DjangoTagRepository:
    """Implementação concreta usando Django ORM."""
    def get_by_slug(self, slug: str) -> Optional[Tag]:
        return Tag.objects.filter(slug=slug).first()

    def get_or_create(self, name: str, slug: Optional[str] = None) -> Tag:
        if slug is None:
            slug = name.lower().replace(' ', '-')
        tag, _ = Tag.objects.get_or_create(slug=slug, defaults={"name": name})
        return tag

    def filter_by_ids(self, ids: List[UUID]) -> List[Tag]:
        return list(Tag.objects.filter(id__in=ids))

    def all(self) -> List[Tag]:
        return list(Tag.objects.all())
