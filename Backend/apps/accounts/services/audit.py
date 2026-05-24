from typing import Optional
from django.contrib.auth import get_user_model

User = get_user_model()

class AdminAuditService:
    @classmethod
    def record(
        cls,
        *,
        action: str,
        actor: Optional[User],
        target: User,
        metadata: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        from apps.accounts.models import AdminAuditEvent

        AdminAuditEvent.objects.create(
            actor=actor,
            target=target,
            action=action,
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent or "",
        )
