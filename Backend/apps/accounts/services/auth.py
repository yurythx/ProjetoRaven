import logging
import secrets
from datetime import timedelta
from typing import Optional
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
from django.contrib.auth.models import Group
from django.db import transaction
from django.utils import timezone
from apps.accounts.validators import CustomValidators
from .audit import AdminAuditService
from ..repositories.user import UserRepository, DjangoUserRepository

User = get_user_model()

class AuthService:
    """Unified service for Authentication and Registration.
    
    DIP: Uses UserRepository abstraction for data access.
    SRP: Handles authentication and registration operations.
    """

    DEFAULT_GROUP = "members"

    def __init__(self, repository: UserRepository = None):
        self.repository = repository or DjangoUserRepository()

    @transaction.atomic
    def register_user(
        self,
        email: str,
        username: str,
        password: str,
        display_name: Optional[str] = None,
        birth_date=None,
        gender: Optional[str] = None,
        registration_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        from django.core.exceptions import ValidationError as DjangoValidationError

        email = CustomValidators.validate_email(email)
        username = CustomValidators.validate_username(username)
        try:
            password = CustomValidators.validate_password(password)
        except DjangoValidationError as e:
            raise ValueError(str(e))

        if self.repository.get_by_email_case_insensitive(email):
            raise ValueError("Email already registered.")

        if self.repository.get_by_username_case_insensitive(username):
            raise ValueError("Username already taken.")

        if birth_date:
            try:
                birth_date = CustomValidators.validate_birth_date(birth_date)
            except DjangoValidationError as e:
                raise ValueError(str(e))

        user = User(
            email=email,
            username=username,
            display_name=display_name or username,
            birth_date=birth_date,
            gender=gender or User.Gender.NOT_SPECIFIED,
            registration_ip=registration_ip or "",
            verification_token=secrets.token_urlsafe(32),
            verification_token_created_at=timezone.now(),
            is_active=False,
        )
        user.set_password(password)
        user.save()

        player_group = Group.objects.filter(name=self.DEFAULT_GROUP).first()
        if player_group:
            user.groups.add(player_group)

        AdminAuditService.record(
            action="register_user",
            actor=None,
            target=user,
            metadata={},
            ip_address=registration_ip,
            user_agent=user_agent,
        )

        return user

    def _send_welcome_email(self, user: User) -> None:
        from django.conf import settings
        from django.template.loader import render_to_string
        from apps.accounts.emailing import send_email

        site_url = getattr(settings, "NEXT_PUBLIC_SITE_URL", "")
        context = {"display_name": user.display_name or user.username, "site_url": site_url}
        try:
            html = render_to_string("emails/welcome.html", context)
            body = render_to_string("emails/welcome.txt", context)
            send_email(to_email=user.email, subject="Bem-vindo ao Raven Universe!", body=body, html_body=html)
        except Exception as exc:
            logger.warning("welcome_email_failed user_id=%s error=%s", user.id, exc)

    def authenticate(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
    ) -> Optional[User]:
        user = self.repository.get_by_email_case_insensitive(email)

        if not user:
            return None

        if not user.check_password(password):
            return None

        if not user.is_active_and_not_banned:
            return None

        if not (user.is_verified or user.is_admin_verified) and not user.is_staff and not user.is_superuser:
            return None

        user.last_login = timezone.now()
        user.last_login_ip = ip_address
        user.save(update_fields=["last_login", "last_login_ip"])
        return user

    def send_verification_email(
        self,
        user,
        ip_address,
        user_agent,
        resend: bool = False
    ) -> bool:
        from django.conf import settings
        from django.template.loader import render_to_string
        from apps.accounts.emailing import OneTimeCodeService, send_email

        expires_minutes = getattr(settings, "ACCOUNTS_EMAIL_VERIFY_CODE_EXPIRES_MINUTES", 10)
        try:
            code = OneTimeCodeService.issue(
                user=user,
                purpose="email_verify",
                expires_in_minutes=expires_minutes,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            context = {"code": code, "expires_minutes": expires_minutes}
            body = render_to_string("emails/email_verify_code.txt", context)
            send_email(to_email=user.email, subject="Confirme seu e-mail", body=body)
            AdminAuditService.record(
                action="email_verify_sent",
                actor=None,
                target=user,
                metadata={"resend": resend},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            return True
        except Exception as exc:
            logger.error("send_verification_email_failed user_id=%s error=%s", user.id, exc)
            return False

    def verify_email(
        self,
        email: str,
        code: str,
        ip_address: str = None,
        user_agent: str = None
    ):
        from django.conf import settings
        from apps.accounts.emailing import OneTimeCodeService
        
        user = self.repository.get_by_email_case_insensitive(email)
        if not user:
            raise ValueError("Invalid code.")
        if user.is_verified:
            raise ValueError("Email already verified.")

        ok = OneTimeCodeService.verify(
            user=user,
            purpose="email_verify",
            code=code,
            max_attempts=getattr(settings, "ACCOUNTS_OTP_MAX_ATTEMPTS", 10),
        )
        if not ok:
            raise ValueError("Invalid code.")

        user.verify()
        AdminAuditService.record(
            action="email_verified",
            actor=user,
            target=user,
            metadata={},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._send_welcome_email(user)
        return user

    def request_password_reset(
        self,
        email: str,
        ip_address: str = None,
        user_agent: str = None
    ) -> bool:
        from django.conf import settings
        from django.template.loader import render_to_string
        from apps.accounts.emailing import OneTimeCodeService, send_email
        
        user = self.repository.get_by_email_case_insensitive(email)
        if not user or user.is_banned:
            return False

        expires_minutes = getattr(settings, "ACCOUNTS_PASSWORD_RESET_CODE_EXPIRES_MINUTES", 10)
        try:
            code = OneTimeCodeService.issue(
                user=user,
                purpose="password_reset",
                expires_in_minutes=expires_minutes,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            context = {"code": code, "expires_minutes": expires_minutes}
            body = render_to_string("emails/password_reset_code.txt", context)
            send_email(to_email=user.email, subject="Recuperação de senha", body=body)
            AdminAuditService.record(
                action="password_reset_sent",
                actor=None,
                target=user,
                metadata={},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            return True
        except Exception as exc:
            logger.error("request_password_reset_email_failed user_id=%s error=%s", user.id, exc)
            return False

    def confirm_password_reset(
        self,
        email: str,
        code: str,
        new_password: str,
        ip_address: str = None,
        user_agent: str = None
    ):
        from django.conf import settings
        from apps.accounts.emailing import OneTimeCodeService
        
        user = self.repository.get_by_email_case_insensitive(email)
        if not user or user.is_banned:
            raise ValueError("Invalid code.")

        ok = OneTimeCodeService.verify(
            user=user,
            purpose="password_reset",
            code=code,
            max_attempts=getattr(settings, "ACCOUNTS_OTP_MAX_ATTEMPTS", 10),
        )
        if not ok:
            raise ValueError("Invalid code.")

        user.set_password(new_password)
        user.last_password_change = timezone.now()
        user.save(update_fields=["password", "last_password_change"])

        # Blacklist all outstanding JWT tokens (force re-login on all devices)
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
        except Exception as exc:
            logger.warning("token_blacklist_failed user_id=%s error=%s", user.id, exc)

        AdminAuditService.record(
            action="password_reset_confirmed",
            actor=user,
            target=user,
            metadata={},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user
