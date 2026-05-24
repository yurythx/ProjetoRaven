from typing import Protocol, List, Optional
from uuid import UUID
from apps.blog.models import Post

class PostRepository(Protocol):
    """Abstração de acesso a Posts (DIP)."""
    def get_by_slug(self, slug: str) -> Optional[Post]:
        ...
    def filter(self, **filters):
        ...
    def get_all(self):
        ...
    def create(self, **data) -> Post:
        ...
    def update(self, post: Post, **data) -> Post:
        ...
    def delete(self, post: Post) -> None:
        ...

class DjangoPostRepository:
    """Implementação concreta usando o ORM do Django."""
    def get_by_slug(self, slug: str) -> Optional[Post]:
        return Post.objects.filter(slug=slug).first()

    def filter(self, **filters):
        return Post.objects.filter(**filters)

    def get_all(self):
        return Post.objects.all()

    def create(self, **data) -> Post:
        return Post.objects.create(**data)

    def update(self, post: Post, **data) -> Post:
        for k, v in data.items():
            setattr(post, k, v)
        post.save()
        return post

    def delete(self, post: Post) -> None:
        post.delete()
