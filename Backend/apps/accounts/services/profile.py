from typing import Optional
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from apps.accounts.validators import CustomValidators
from ..repositories.user import UserRepository, DjangoUserRepository

User = get_user_model()

class ProfileService:
    """Service for user profile operations.
    
    SRP: Only handles profile-related operations.
    DIP: Uses repository for user data access.
    """

    def __init__(self, repository: UserRepository = None):
        self.repository = repository or DjangoUserRepository()

    def get_profile(self, user: User) -> dict:
        return {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "display_name": user.display_name,
            "birth_date": user.birth_date,
            "gender": user.gender,
            "is_verified": user.is_verified,
            "date_joined": user.date_joined,
            "last_login": user.last_login,
            "groups": [g.name for g in user.groups.all()],
            "permissions": list(user.get_all_permissions()),
        }

    @transaction.atomic
    def update_own_profile(self, user: User, data: dict) -> User:
        allowed_fields = ["display_name", "bio", "website", "birth_date", "gender"]

        for field in allowed_fields:
            if field in data:
                if field == "birth_date" and data[field]:
                    data[field] = CustomValidators.validate_birth_date(data[field])
                setattr(user, field, data[field])

        user.save()
        return user

    @transaction.atomic
    def change_own_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
    ) -> User:
        if not user.check_password(current_password):
            raise ValueError("Current password is incorrect.")

        new_password = CustomValidators.validate_password(new_password)
        user.set_password(new_password)
        user.last_password_change = timezone.now()
        user.save(update_fields=["password", "last_password_change"])

        # Blacklist all outstanding tokens — force re-login on all devices
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
        except Exception:
            pass

        return user

    def generate_unity_token(
        self,
        user: User,
        client_id: str,
        ip_address: str = None,
        user_agent: str = None
    ):
        from datetime import timedelta
        from rest_framework_simplejwt.tokens import AccessToken
        from .audit import AdminAuditService

        if not client_id:
            raise ValueError("client_id is required.")

        token = AccessToken.for_user(user)
        token.set_exp(lifetime=timedelta(minutes=5))
        token["token_type"] = "unity_auth"
        token["client_id"] = client_id
        token["display_name"] = user.display_name

        jwt_str = str(token)
        expires_at = timezone.now() + timedelta(minutes=5)
        deep_link = f"raven-game://auth?token={jwt_str}&expires={expires_at.isoformat()}"

        AdminAuditService.record(
            action="unity_token_issued",
            actor=user,
            target=user,
            metadata={"client_id": client_id, "expires_at": expires_at.isoformat()},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return {
            "deep_link": deep_link,
            "token": jwt_str,
            "expires_at": expires_at.isoformat()
        }
