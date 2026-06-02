from django.db.models import Q
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

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        query = (params.get("q") or params.get("search") or "").strip()
        if query:
            qs = qs.filter(
                Q(actor__email__icontains=query) | Q(actor__username__icontains=query)
                | Q(target__email__icontains=query) | Q(target__username__icontains=query)
            )

        for field, param in [("target_id", "target"), ("actor_id", "actor"), ("action", "action")]:
            val = params.get(param)
            if val:
                qs = qs.filter(**{field: val})

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
