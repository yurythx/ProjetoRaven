from rest_framework import viewsets, response, status
from rest_framework.decorators import action
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.utils import timezone
from django.db.models import Q
from apps.common.throttling import BlogPostThrottle

from ...services.post import PostService
from ...repositories.post import DjangoPostRepository
from ...repositories.tag import DjangoTagRepository
from ...selectors.post import PostSelector
from ...serializers.post import PostListSerializer, PostDetailSerializer, PostCreateSerializer, PostUpdateSerializer
from ...permissions.blog_permissions import IsBlogEditorOrReadOnly
from ...models import Post

class PostViewSet(viewsets.ModelViewSet):
    """
    Unified ViewSet for Posts.
    Following SRP (Delegates logic to PostService).
    """
    permission_classes = [IsBlogEditorOrReadOnly]
    throttle_classes = [AnonRateThrottle, UserRateThrottle]
    lookup_field = "slug"

    def get_throttles(self):
        if self.action in ("create", "update", "partial_update"):
            return [AnonRateThrottle(), BlogPostThrottle()]
        return super().get_throttles()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.repository = DjangoPostRepository()
        self.service = PostService(self.repository)

    def get_serializer_class(self):
        if self.action == "list":
            return PostListSerializer
        if self.action == "create":
            return PostCreateSerializer
        if self.action in ["update", "partial_update"]:
            return PostUpdateSerializer
        return PostDetailSerializer

    def get_queryset(self):
        user = self.request.user
        is_editor = bool(
            user
            and user.is_authenticated
            and (getattr(user, "is_blog_editor", False) or user.is_staff or user.is_superuser)
        )
        if is_editor:
            return PostSelector.get_admin_list()
        # Authenticated non-editors: published posts (including non-public/members-only)
        if getattr(user, "is_authenticated", False):
            return (
                Post.objects.filter(status=Post.Status.PUBLISHED)
                .select_related("author", "category")
                .prefetch_related("tags")
            )
        # Unauthenticated: published + public only
        return PostSelector.get_published()

    def _apply_admin_filters(self, qs):
        params = self.request.query_params

        status_param = (params.get("status") or "").strip().lower()
        if status_param:
            allowed = {s for s, _ in Post.Status.choices}
            if status_param in allowed:
                qs = qs.filter(status=status_param)

        category_param = (params.get("category") or "").strip()
        if category_param:
            if "-" in category_param:
                qs = qs.filter(category_id=category_param)
            else:
                qs = qs.filter(category__slug=category_param)

        search = (params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(slug__icontains=search)
                | Q(excerpt__icontains=search)
                | Q(author__username__icontains=search)
                | Q(author__email__icontains=search)
                | Q(category__name__icontains=search)
            )

        ordering = (params.get("ordering") or "").strip()
        if ordering:
            raw = ordering[1:] if ordering.startswith("-") else ordering
            allowed = {"updated_at", "created_at", "published_at", "view_count", "title"}
            if raw in allowed:
                qs = qs.order_by(ordering)

        return qs

    def retrieve(self, request, *args, **kwargs):
        from django.db.models import F
        instance = self.get_object()
        # Increment view count atomically
        Post.objects.filter(pk=instance.pk).update(view_count=F("view_count") + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return response.Response(serializer.data)

    def list(self, request):
        qs = self.get_queryset()
        user = request.user
        is_editor = bool(
            user
            and user.is_authenticated
            and (getattr(user, "is_blog_editor", False) or user.is_staff or user.is_superuser)
        )
        if is_editor:
            qs = self._apply_admin_filters(qs)
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return response.Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        self.service.delete_post(instance, post_repo=self.repository)

    @action(detail=False, methods=["post"], url_path="bulk-publish")
    def bulk_publish(self, request):
        ids = request.data.get("ids", [])
        posts = self.repository.filter(id__in=ids)
        updated = self.service.bulk_publish(posts, request.user)
        return response.Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="bulk/publish")
    def bulk_publish_by_slug(self, request):
        slugs = request.data.get("slugs", [])
        posts = Post.objects.filter(slug__in=slugs)
        approved, failed = [], []
        for post in posts:
            try:
                post.publish()
                approved.append(post.slug)
            except Exception as exc:
                failed.append({"slug": post.slug, "error": str(exc)})
        return response.Response({"approved": approved, "failed": failed})

    @action(detail=False, methods=["post"], url_path="bulk/reject")
    def bulk_reject_by_slug(self, request):
        slugs = request.data.get("slugs", [])
        reason = str(request.data.get("reason", ""))
        posts = Post.objects.filter(slug__in=slugs)
        rejected, failed = [], []
        for post in posts:
            try:
                post.reject(reason)
                rejected.append(post.slug)
            except Exception as exc:
                failed.append({"slug": post.slug, "error": str(exc)})
        return response.Response({"rejected": rejected, "failed": failed})

    @action(detail=True, methods=["get"])
    def history(self, request, slug=None):
        from ...models import PostRevision
        post = self.get_object()
        revisions = PostRevision.objects.filter(post=post).select_related("user").order_by("-created_at")[:50]
        data = [
            {
                "id": str(rev.id),
                "created_at": rev.created_at.isoformat(),
                "user": rev.user.username if rev.user else None,
                "comment": rev.comment,
                "title": rev.data.get("title", ""),
                "status": rev.data.get("status", ""),
            }
            for rev in revisions
        ]
        return response.Response(data)

    @action(detail=True, methods=["post"])
    def revert(self, request, slug=None):
        from ...models import PostRevision
        post = self.get_object()
        revision_id = request.data.get("revision_id") or request.data.get("version_id")
        if not revision_id:
            return response.Response({"detail": "revision_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rev = PostRevision.objects.get(id=revision_id, post=post)
        except PostRevision.DoesNotExist:
            return response.Response({"detail": "Revision not found."}, status=status.HTTP_404_NOT_FOUND)

        self.service.update_post(
            post,
            {k: v for k, v in rev.data.items() if k in ("title", "content", "excerpt", "status")},
            user=request.user,
            revision_comment=f"Reverted to revision {rev.id}",
        )
        return response.Response({"message": "Reverted successfully."})

    @action(detail=True, methods=["post"])
    def publish(self, request, slug=None):
        post = self.get_object()
        post.publish()
        return response.Response({"message": "Published successfully."})

    @action(detail=True, methods=["post"])
    def submit(self, request, slug=None):
        post = self.get_object()
        post.submit_for_review()
        return response.Response({"message": "Submitted for review."})

    @action(detail=True, methods=["post"])
    def reject(self, request, slug=None):
        post = self.get_object()
        reason = request.data.get("reason", "")
        post.reject(str(reason or ""))
        return response.Response({"message": "Rejected."})

    @action(detail=True, methods=["post"])
    def archive(self, request, slug=None):
        post = self.get_object()
        post.archive()
        return response.Response({"message": "Archived."})

    @action(detail=True, methods=["post"])
    def schedule(self, request, slug=None):
        from django.utils.dateparse import parse_datetime
        post = self.get_object()
        published_at_str = request.data.get("published_at")
        if not published_at_str:
            return response.Response({"detail": "published_at is required."}, status=status.HTTP_400_BAD_REQUEST)
        published_at = parse_datetime(str(published_at_str))
        if not published_at:
            return response.Response({"detail": "Invalid published_at format."}, status=status.HTTP_400_BAD_REQUEST)
        if published_at.tzinfo is None:
            from django.utils.timezone import make_aware
            published_at = make_aware(published_at)
        if published_at <= timezone.now():
            return response.Response({"detail": "A data de publicação deve ser no futuro."}, status=status.HTTP_400_BAD_REQUEST)
        post.schedule(published_at)
        return response.Response({"message": "Scheduled successfully.", "published_at": published_at.isoformat()})

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        from django.db.models import Sum
        qs = self.get_queryset()
        published_qs = qs.filter(status=Post.Status.PUBLISHED)
        most_viewed = list(
            published_qs.order_by("-view_count")[:5].values("id", "title", "slug", "view_count")
        )
        return response.Response({
            "total_articles": qs.count(),
            "total_views": qs.aggregate(Sum("view_count"))["view_count__sum"] or 0,
            "published_count": published_qs.count(),
            "draft_count": qs.filter(status=Post.Status.DRAFT).count(),
            "most_viewed": [
                {
                    "id": str(p["id"]),
                    "title": p["title"],
                    "slug": p["slug"],
                    "total_views": p["view_count"],
                    "views_last_30_days": p["view_count"],
                }
                for p in most_viewed
            ],
            "views_by_date": [],
        })
