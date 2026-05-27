from django.db.models import Q
from rest_framework import viewsets, response, status, permissions
from rest_framework.decorators import action
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from ...services.comment import CommentService
from ...repositories.comment import DjangoCommentRepository
from ...serializers.comment import CommentListSerializer, CommentCreateSerializer, ModerationCommentSerializer
from ...permissions.blog_permissions import IsBlogEditor
from apps.common.throttling import CommentThrottle

_EDITOR_ACTIONS = {
    "approve", "disapprove", "destroy", "list_pending",
    "bulk_approve", "bulk_disapprove", "bulk_delete",
    "bulk_filtered_count", "bulk_approve_filtered", "bulk_disapprove_filtered", "bulk_delete_filtered",
    "approve_thread", "disapprove_thread", "delete_thread",
    "replies",
}


class CommentViewSet(viewsets.GenericViewSet):
    """ViewSet for comment management — business logic delegated to CommentService."""

    repository = DjangoCommentRepository()
    service = CommentService(repository)
    throttle_classes = [AnonRateThrottle, UserRateThrottle]

    def get_permissions(self):
        if self.action in _EDITOR_ACTIONS:
            return [IsBlogEditor()]
        return [permissions.AllowAny()]

    def get_throttles(self):
        if self.action == "create":
            return [CommentThrottle()]
        return super().get_throttles()

    # ── Create ──────────────────────────────────────────────────────────────

    def create(self, request):
        serializer = CommentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            comment = serializer.save()
            return response.Response(
                CommentListSerializer(comment).data,
                status=status.HTTP_201_CREATED,
            )
        except (ValueError, PermissionError) as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ── List ────────────────────────────────────────────────────────────────

    def list(self, request):
        from apps.blog.models import Comment

        post_slug = request.query_params.get("post_slug")
        post_id = request.query_params.get("post") or request.query_params.get("article")
        is_editor = request.user and request.user.is_authenticated and (
            getattr(request.user, "is_blog_editor", False)
            or getattr(request.user, "is_staff", False)
            or getattr(request.user, "is_superuser", False)
        )

        if not post_slug and not post_id and not is_editor:
            return response.Response(
                {"detail": "post_slug or post is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filters = {}
        if post_slug:
            filters["post__slug"] = post_slug
        elif post_id:
            filters["post_id"] = post_id

        # Approval filter
        is_approved_param = request.query_params.get("is_approved")
        if is_editor and is_approved_param is not None:
            filters["is_approved"] = is_approved_param.lower() not in ("false", "0")
        elif not is_editor:
            filters["is_approved"] = True

        # Public filter
        is_public_param = request.query_params.get("is_public")
        if is_public_param is not None:
            filters["is_public"] = is_public_param.lower() not in ("false", "0")

        # Parent filter
        parent_isnull = request.query_params.get("parent__isnull")
        if parent_isnull is not None:
            filters["parent__isnull"] = parent_isnull.lower() not in ("false", "0")

        # Date range
        created_gte = request.query_params.get("created_at__gte")
        created_lte = request.query_params.get("created_at__lte")
        if created_gte:
            filters["created_at__gte"] = created_gte
        if created_lte:
            filters["created_at__lte"] = created_lte

        ordering = request.query_params.get("ordering", "-created_at")
        qs = Comment.objects.filter(**filters).select_related("post", "author").order_by(ordering)

        # Full-text search
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(content__icontains=search) | Q(name__icontains=search) | Q(email__icontains=search))

        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CommentListSerializer(page, many=True).data)
        return response.Response(CommentListSerializer(qs, many=True).data)

    # ── Single-item moderation ───────────────────────────────────────────────

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        comment = self.repository.get_by_id(pk)
        if not comment:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        comment.is_approved = True
        comment.save(update_fields=["is_approved"])
        return response.Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def disapprove(self, request, pk=None):
        comment = self.repository.get_by_id(pk)
        if not comment:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        comment.is_approved = False
        comment.save(update_fields=["is_approved"])
        return response.Response({"status": "disapproved"})

    def destroy(self, request, pk=None):
        comment = self.repository.get_by_id(pk)
        if not comment:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        self.repository.delete(comment)
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    # ── Replies ─────────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"])
    def replies(self, request, pk=None):
        from apps.blog.models import Comment
        parent = self.repository.get_by_id(pk)
        if not parent:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        qs = Comment.objects.filter(parent=parent).select_related("post", "author").order_by("created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CommentListSerializer(page, many=True).data)
        return response.Response(CommentListSerializer(qs, many=True).data)

    # ── Thread moderation ────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="approve_thread")
    def approve_thread(self, request, pk=None):
        from apps.blog.models import Comment
        parent = self.repository.get_by_id(pk)
        if not parent:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        Comment.objects.filter(
            Q(id=parent.id) | Q(parent_id=parent.id)
        ).update(is_approved=True)
        return response.Response({"status": "thread_approved"})

    @action(detail=True, methods=["post"], url_path="disapprove_thread")
    def disapprove_thread(self, request, pk=None):
        from apps.blog.models import Comment
        parent = self.repository.get_by_id(pk)
        if not parent:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        Comment.objects.filter(
            Q(id=parent.id) | Q(parent_id=parent.id)
        ).update(is_approved=False)
        return response.Response({"status": "thread_disapproved"})

    @action(detail=True, methods=["post"], url_path="delete_thread")
    def delete_thread(self, request, pk=None):
        from apps.blog.models import Comment
        parent = self.repository.get_by_id(pk)
        if not parent:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        Comment.objects.filter(
            Q(id=parent.id) | Q(parent_id=parent.id)
        ).delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    # ── Bulk moderation ──────────────────────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="bulk_approve")
    def bulk_approve(self, request):
        from apps.blog.models import Comment
        ids = request.data.get("ids", [])
        updated = Comment.objects.filter(id__in=ids).update(is_approved=True)
        return response.Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="bulk_disapprove")
    def bulk_disapprove(self, request):
        from apps.blog.models import Comment
        ids = request.data.get("ids", [])
        updated = Comment.objects.filter(id__in=ids).update(is_approved=False)
        return response.Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="bulk_delete")
    def bulk_delete(self, request):
        from apps.blog.models import Comment
        ids = request.data.get("ids", [])
        deleted, _ = Comment.objects.filter(id__in=ids).delete()
        return response.Response({"deleted": deleted})

    # ── Bulk filtered moderation ─────────────────────────────────────────────

    def _build_filter_qs(self, payload: dict):
        """Build a Comment queryset from a filter payload sent by the moderation UI."""
        from apps.blog.models import Comment

        filters: dict = {}
        if "is_approved" in payload:
            val = payload["is_approved"]
            if isinstance(val, str):
                filters["is_approved"] = val.lower() not in ("false", "0")
            else:
                filters["is_approved"] = bool(val)
        if "is_public" in payload:
            val = payload["is_public"]
            filters["is_public"] = (val not in (False, "false", "0")) if not isinstance(val, bool) else val
        if "parent__isnull" in payload:
            val = payload["parent__isnull"]
            filters["parent__isnull"] = (val not in (False, "false", "0")) if not isinstance(val, bool) else val
        if payload.get("article"):
            filters["post_id"] = payload["article"]
        if payload.get("created_at__gte"):
            filters["created_at__gte"] = payload["created_at__gte"]
        if payload.get("created_at__lte"):
            filters["created_at__lte"] = payload["created_at__lte"]

        qs = Comment.objects.filter(**filters)

        search = (payload.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(content__icontains=search) | Q(name__icontains=search) | Q(email__icontains=search)
            )

        include_replies = payload.get("include_replies", True)
        if include_replies and "parent__isnull" not in filters:
            pass  # no additional filter needed
        elif not include_replies:
            qs = qs.filter(parent__isnull=True)

        return qs

    @action(detail=False, methods=["post"], url_path="bulk_filtered_count")
    def bulk_filtered_count(self, request):
        qs = self._build_filter_qs(request.data)
        count = qs.count()
        sample = qs.select_related("post", "author").order_by("-created_at")[:5]
        sample_data = ModerationCommentSerializer(sample, many=True).data
        return response.Response({"count": count, "sample_items": sample_data})

    @action(detail=False, methods=["post"], url_path="bulk_approve_filtered")
    def bulk_approve_filtered(self, request):
        qs = self._build_filter_qs(request.data)
        updated = qs.update(is_approved=True)
        return response.Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="bulk_disapprove_filtered")
    def bulk_disapprove_filtered(self, request):
        qs = self._build_filter_qs(request.data)
        updated = qs.update(is_approved=False)
        return response.Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="bulk_delete_filtered")
    def bulk_delete_filtered(self, request):
        qs = self._build_filter_qs(request.data)
        deleted, _ = qs.delete()
        return response.Response({"deleted": deleted})

    # ── Legacy ───────────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="pending")
    def list_pending(self, request):
        from apps.blog.models import Comment
        pending = Comment.objects.filter(is_approved=False).select_related("post", "author")
        serializer = ModerationCommentSerializer(pending, many=True)
        return response.Response(serializer.data)
