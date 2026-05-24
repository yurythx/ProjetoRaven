from typing import Protocol, Optional, List
from uuid import UUID
from apps.blog.models import Comment, Post

class CommentRepository(Protocol):
    """Abstração de acesso a comentários (DIP)."""
    def get_post_by_slug(self, slug: str) -> Optional[Post]:
        ...
    def create(
        self,
        *,
        post: Post,
        parent: Optional[Comment] = None,
        author,
        content: str,
        name: str = "",
        email: str = "",
        website: str = "",
        is_public: bool = True,
        is_approved: bool = False,
    ) -> Comment:
        ...
    def list_by_post(self, post: Post) -> List[Comment]:
        ...
    def delete(self, comment: Comment) -> None:
        ...

class DjangoCommentRepository:
    """Implementação concreta usando Django ORM."""
    def get_post_by_slug(self, slug: str) -> Optional[Post]:
        return Post.objects.filter(slug=slug).first()

    def create(
        self,
        *,
        post: Post,
        parent: Optional[Comment] = None,
        author,
        content: str,
        name: str = "",
        email: str = "",
        website: str = "",
        is_public: bool = True,
        is_approved: bool = False,
    ) -> Comment:
        comment = Comment(
            post=post,
            parent=parent,
            author=author,
            content=content,
            name=name,
            email=email,
            website=website,
            is_public=is_public,
            is_approved=is_approved,
        )
        comment.save()
        return comment

    def list_by_post(self, post: Post) -> List[Comment]:
        return list(Comment.objects.filter(post=post).order_by("-created_at"))

    def get_by_id(self, comment_id: str) -> Optional[Comment]:
        return Comment.objects.filter(id=comment_id).first()

    def update(self, comment: Comment, **kwargs) -> Comment:
        for key, value in kwargs.items():
            setattr(comment, key, value)
        comment.save()
        return comment

    def delete(self, comment: Comment) -> None:
        comment.delete()
