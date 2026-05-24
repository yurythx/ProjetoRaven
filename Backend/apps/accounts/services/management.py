import logging
from typing import Optional
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.utils import timezone
from apps.accounts.validators import CustomValidators
from .audit import AdminAuditService
from ..repositories.user import UserRepository, DjangoUserRepository

logger = logging.getLogger(__name__)



User = get_user_model()

class UserManagementService:
    """Service for user management operations (admin/moderator).
    遵循 SRP (Single Responsibility) - 专注于用户管理逻辑。
    遵循 DIP (Dependency Inversion) - 依赖于 UserRepository 接口。
    """

    def __init__(self, repository: UserRepository = DjangoUserRepository()):
        self.repository = repository

    @transaction.atomic
    def ban_user(
        self,
        user: User,
        reason: str,
        banned_by: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        if not banned_by.is_admin and not banned_by.is_forum_moderator:
            raise PermissionError("You don't have permission to ban users.")

        if user.is_superuser:
            raise ValueError("Cannot ban a superuser.")

        reason = CustomValidators.validate_ban_reason(reason)
        user.ban(reason=reason, banned_by=banned_by)
        
        AdminAuditService.record(
            action="ban",
            actor=banned_by,
            target=user,
            metadata={"reason": reason},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user

    @transaction.atomic
    def unban_user(
        self,
        user: User,
        unbanned_by: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        if not unbanned_by.is_admin:
            raise PermissionError("Only admins can unban users.")

        user.unban()
        AdminAuditService.record(
            action="unban",
            actor=unbanned_by,
            target=user,
            metadata={},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user

    @transaction.atomic
    def update_user(
        self,
        user: User,
        data: dict,
        updated_by: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        allowed_fields = ["display_name", "birth_date", "gender"]

        if updated_by.is_admin:
            allowed_fields.extend(["is_active", "is_staff"])

        if updated_by.is_superuser:
            allowed_fields.extend(["is_superuser"])

        before = {}
        changes = {}
        for field in allowed_fields:
            if field in data:
                if field in ["is_staff", "is_superuser"] and user.pk == updated_by.pk:
                    raise PermissionError("Cannot change your own role.")
                if field in ["is_staff", "is_superuser"] and user.is_superuser and not updated_by.is_superuser:
                    raise PermissionError("Only superusers can change a superuser role.")
                if field == "is_active" and data[field] is False:
                    if user.is_superuser:
                        raise PermissionError("Cannot deactivate a superuser.")
                    if user.pk == updated_by.pk:
                        raise PermissionError("Cannot deactivate yourself.")
                before[field] = getattr(user, field)
                setattr(user, field, data[field])
                changes[field] = data[field]

        self.repository.update(user, **changes)
        
        if changes and updated_by.is_admin:
            def _normalize(v):
                if v is None:
                    return None
                if hasattr(v, "isoformat"):
                    return v.isoformat()
                return v

            AdminAuditService.record(
                action="update_user",
                actor=updated_by,
                target=user,
                metadata={
                    "changes": {k: {"from": _normalize(before.get(k)), "to": _normalize(changes.get(k))} for k in changes.keys()},
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
        return user

    @transaction.atomic
    def change_user_groups(
        self,
        user: User,
        group_names: list,
        modified_by: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        if not modified_by.is_admin:
            raise PermissionError("Only admins can modify user groups.")

        if user.is_superuser and not modified_by.is_superuser:
            raise PermissionError("Only superusers can modify superuser groups.")

        groups = list(Group.objects.filter(name__in=group_names))
        found_names = {g.name for g in groups}
        missing = [n for n in group_names if n not in found_names]
        if missing:
            raise ValueError(f"Unknown groups: {', '.join(missing)}")

        before_groups = list(user.groups.values_list("name", flat=True))
        user.groups.set(groups)
        after_groups = sorted([g.name for g in groups])
        AdminAuditService.record(
            action="change_groups",
            actor=modified_by,
            target=user,
            metadata={"from": sorted(before_groups), "to": after_groups},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user

    @transaction.atomic
    def reset_password(
        self,
        user: User,
        new_password: str,
        reset_by: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        if not reset_by.is_admin:
            raise PermissionError("Only admins can reset passwords.")

        password = CustomValidators.validate_password(new_password)
        user.set_password(password)
        user.last_password_change = timezone.now()
        self.repository.update(user, password=user.password, last_password_change=user.last_password_change)
        
        AdminAuditService.record(
            action="reset_password",
            actor=reset_by,
            target=user,
            metadata={},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user

    def activate_user(self, user: User, actor: User, ip_address: str = None, user_agent: str = None):
        self.repository.update(user, is_active=True)
        AdminAuditService.record(
            action="activate", actor=actor, target=user, metadata={},
            ip_address=ip_address, user_agent=user_agent
        )
        return user

    def deactivate_user(self, user: User, actor: User, ip_address: str = None, user_agent: str = None):
        if user.id == actor.id:
            raise ValueError("Cannot deactivate yourself.")
        if user.is_superuser:
            raise ValueError("Cannot deactivate a superuser.")
        self.repository.update(user, is_active=False)
        AdminAuditService.record(
            action="deactivate", actor=actor, target=user, metadata={},
            ip_address=ip_address, user_agent=user_agent
        )
        return user

    def verify_admin(self, user: User, actor: User, ip_address: str = None, user_agent: str = None):
        user.verify_admin(verified_by=actor)
        AdminAuditService.record(
            action="admin_verified", actor=actor, target=user, metadata={},
            ip_address=ip_address, user_agent=user_agent
        )
        return user
