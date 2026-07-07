from django.db.models import Q
import uuid
from rest_framework import viewsets, permissions
from rest_framework.pagination import PageNumberPagination

from ..models import AdminAuditEvent
from ..serializers.admin import AdminAuditEventSerializer

class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200

class AdminAuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for admin audit trail."""
    queryset = AdminAuditEvent.objects.select_related("actor", "target").all()
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminAuditEventSerializer
    pagination_class = StandardPagination

    @staticmethod
    def _apply_user_filter(qs, relation: str, raw_value: str):
        value = (raw_value or "").strip()
        if not value:
            return qs

        try:
            parsed = uuid.UUID(value)
            return qs.filter(**{f"{relation}_id": parsed})
        except ValueError:
            return qs.filter(
                Q(**{f"{relation}__email__icontains": value})
                | Q(**{f"{relation}__username__icontains": value})
                | Q(**{f"{relation}__display_name__icontains": value})
            )

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        query = (params.get("q") or params.get("search") or "").strip()
        if query:
            qs = qs.filter(
                Q(actor__email__icontains=query) | Q(actor__username__icontains=query)
                | Q(target__email__icontains=query) | Q(target__username__icontains=query)
            )

        target = params.get("target")
        if target:
            qs = self._apply_user_filter(qs, "target", target)

        actor = params.get("actor")
        if actor:
            qs = self._apply_user_filter(qs, "actor", actor)

        action = params.get("action")
        if action:
            qs = qs.filter(action=action)

        action_prefix = (params.get("action_prefix") or "").strip()
        if action_prefix:
            qs = qs.filter(action__startswith=action_prefix)

        ordering = params.get("ordering")
        if ordering:
            allowed = {"created_at", "action"}
            fields = [p for p in (x.strip() for x in str(ordering).split(",")) if (p.lstrip("-") in allowed)]
            if fields:
                qs = qs.order_by(*fields)

        return qs
