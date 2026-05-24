from typing import Protocol, List, Optional
from uuid import UUID
from ..models import ForumCategory

class CategoryRepository(Protocol):
    def get_by_id(self, category_id: UUID) -> Optional[ForumCategory]: ...
    def get_by_slug(self, slug: str) -> Optional[ForumCategory]: ...
    def list_active(self) -> List[ForumCategory]: ...
    def create(self, **kwargs) -> ForumCategory: ...
    def update(self, category: ForumCategory, **kwargs) -> ForumCategory: ...
    def delete(self, category: ForumCategory) -> None: ...

class DjangoCategoryRepository:
    def get_by_id(self, category_id: UUID) -> Optional[ForumCategory]:
        return ForumCategory.objects.filter(id=category_id).first()

    def get_by_slug(self, slug: str) -> Optional[ForumCategory]:
        return ForumCategory.objects.filter(slug=slug).first()

    def list_active(self):
        return ForumCategory.objects.filter(is_active=True).order_by("display_order", "name")

    def create(self, **kwargs) -> ForumCategory:
        return ForumCategory.objects.create(**kwargs)

    def update(self, category: ForumCategory, **kwargs) -> ForumCategory:
        for key, value in kwargs.items():
            setattr(category, key, value)
        category.save()
        return category

    def delete(self, category: ForumCategory) -> None:
        category.delete()
