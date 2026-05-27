from typing import Optional
from ..repositories.comment import CommentRepository
from apps.blog.models import Comment
from apps.common.html_sanitizer import sanitize_plain_text

class CommentService:
    """Service layer for comment operations – single responsibility (SRP)."""

    def __init__(self, repo: CommentRepository):
        self.repo = repo

    def create_comment(
        self,
        *,
        author,
        content: str,
        post=None,
        post_slug: Optional[str] = None,
        parent: Optional[Comment] = None,
        name: str = "",
        email: str = "",
        website: str = "",
    ) -> Comment:
        """Create a comment with sanitisation and permission checks.
        O serviço encapsula toda a lógica que antes estava na view.
        """
        # Resolve post if only slug was given
        if post is None:
            if not post_slug:
                raise ValueError("post or post_slug is required.")
            post = self.repo.get_post_by_slug(post_slug)
            if not post:
                raise ValueError("Post not found.")

        # Permission check – same rules used in the original view
        is_authenticated = bool(author and getattr(author, "is_authenticated", False))
        is_editor = (
            is_authenticated
            and (
                getattr(author, "is_blog_editor", False)
                or getattr(author, "is_staff", False)
                or getattr(author, "is_superuser", False)
            )
        )
        if is_authenticated and not is_editor:
            if not getattr(author, "is_active_and_not_banned", False) or not getattr(author, "is_verified", False):
                raise PermissionError("User not allowed.")
        if not is_editor:
            if post.status != post.Status.PUBLISHED or not bool(post.is_public):
                raise ValueError("Post not found.")

        if parent and parent.post_id != post.id:
            raise ValueError("Parent comment must belong to the same post.")

        # Moderation logic: only explicitly allowed users (editors/staff) are auto-approved.
        # Authenticated non-editors are ALWAYS subject to moderation.
        is_approved = bool(is_editor)
        
        # Double check: if user is not editor, force False
        if not is_editor:
            is_approved = False

        safe_content = sanitize_plain_text(content or "")
        safe_name = sanitize_plain_text(name or "")
        safe_email = (email or "").strip()
        safe_website = (website or "").strip()

        if is_authenticated:
            safe_name = ""
            safe_email = ""

        comment = self.repo.create(
            post=post,
            parent=parent,
            author=author,
            content=safe_content,
            name=safe_name,
            email=safe_email,
            website=safe_website,
            is_public=True,
            is_approved=is_approved,
        )

        if is_approved and is_authenticated:
            try:
                from apps.notifications.signals import notify_blog_comment
                notify_blog_comment(post, comment)
            except Exception:
                pass

        return comment
