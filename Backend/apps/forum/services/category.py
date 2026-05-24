from typing import Optional, List
from ..models import ForumCategory
from ..repositories.category import CategoryRepository, DjangoCategoryRepository

class ForumCategoryService:
    """Service for forum category operations."""

    @staticmethod
    def create_category(
        name: str,
        slug: str,
        description: str = "",
        display_order: int = 0,
        icon: str = "",
        is_active: bool = True,
        repository: CategoryRepository = None,
    ) -> ForumCategory:
        """Create a new forum category."""
        if repository is None:
            repository = DjangoCategoryRepository()
        return repository.create(
            name=name,
            slug=slug,
            description=description,
            display_order=display_order,
            icon=icon,
            is_active=is_active,
        )

    @staticmethod
    def get_all_active(repository: CategoryRepository = None):
        """Get all active categories."""
        if repository is None:
            repository = DjangoCategoryRepository()
        return repository.list_active()

    @staticmethod
    def get_by_slug(slug: str, repository: CategoryRepository = None) -> Optional[ForumCategory]:
        """Get category by slug."""
        if repository is None:
            repository = DjangoCategoryRepository()
        return repository.get_by_slug(slug)
