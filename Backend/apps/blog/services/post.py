from django.utils import timezone
from django.utils.text import slugify
from ..models import Post

from ..repositories.post import PostRepository, DjangoPostRepository
from ..repositories.tag import TagRepository, DjangoTagRepository

class PostService:
    """Service for blog posts."""

    def __init__(self, post_repo=None, tag_repo=None):
        self.post_repo = post_repo or DjangoPostRepository()
        self.tag_repo = tag_repo or DjangoTagRepository()

    def list_posts(self, params: dict, post_repo=None):
        if post_repo is None:
            post_repo = self.post_repo
        return post_repo.filter(**params)

    def create_post(self, data: dict, author, post_repo=None) -> Post:
        if post_repo is None:
            post_repo = self.post_repo
        title = data.get("title")
        slug = data.pop("slug", None) or slugify(title)
        tags = data.pop("tags", [])
        data.pop("tag_names", None)
        category_id = data.pop("category", None) or data.pop("category_id", None)
        
        # Initial publishing logic
        if data.get("status") == Post.Status.PUBLISHED:
            data["published_at"] = timezone.now()
            
        post = post_repo.create(
            author=author,
            slug=slug,
            category_id=category_id,
            **data
        )
        if tags:
            post.tags.set(tags)
        return post

    def update_post(self, post: Post, data: dict, user, post_repo=None, revision_comment: str = "") -> Post:
        if post_repo is None:
            post_repo = self.post_repo
        tags = data.pop("tags", None)
        data.pop("tag_names", None)
        category_id = data.pop("category", None) or data.pop("category_id", None)
        if category_id is not None:
            data["category_id"] = category_id

        # Snapshot current state before modifying
        from ..models import PostRevision
        PostRevision.objects.create(
            post=post,
            user=user,
            comment=revision_comment,
            data={
                "title": post.title,
                "content": post.content,
                "excerpt": post.excerpt,
                "status": post.status,
            },
        )

        # Publishing logic
        if data.get("status") == Post.Status.PUBLISHED and post.status != Post.Status.PUBLISHED:
            data["published_at"] = timezone.now()
        elif data.get("status") == Post.Status.DRAFT and post.status == Post.Status.PUBLISHED:
            data["published_at"] = None

        updated_post = post_repo.update(post, **data)
        if tags is not None:
            updated_post.tags.set(tags)
        return updated_post

    def delete_post(self, post: Post, post_repo=None) -> None:
        if post_repo is None:
            post_repo = self.post_repo
        post_repo.delete(post)

    @classmethod
    def bulk_publish(cls, posts, user) -> int:
        count = 0
        for post in posts:
            cls.update_post(post, {"status": Post.Status.PUBLISHED}, user)
            count += 1
        return count
