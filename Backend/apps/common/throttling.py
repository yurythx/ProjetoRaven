import logging

from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


logger = logging.getLogger(__name__)


class ResilientAnonRateThrottle(AnonRateThrottle):
    """
    Fail open when the throttle backend cache is unavailable.

    Public read endpoints should degrade gracefully instead of returning 500
    when Redis/cache is temporarily offline.
    """

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            logger.warning("Anon throttle backend unavailable; allowing request", exc_info=True)
            return True


class ResilientUserRateThrottle(UserRateThrottle):
    """
    Fail open when the throttle backend cache is unavailable.
    """

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            logger.warning("User throttle backend unavailable; allowing request", exc_info=True)
            return True


class LoginThrottle(ResilientAnonRateThrottle):
    # Login is pre-auth: key by IP, not user ID
    scope = "login"
    rate = "10/min"


class RegistrationThrottle(ResilientAnonRateThrottle):
    scope = "register"
    rate = "3/hour"


class PasswordResetThrottle(ResilientAnonRateThrottle):
    scope = "password_reset"
    rate = "3/hour"


class EmailVerificationThrottle(ResilientAnonRateThrottle):
    scope = "otp"
    rate = "5/minute"


class ForumPostThrottle(ResilientUserRateThrottle):
    scope = "forum_post"
    rate = "20/minute"


class BlogPostThrottle(ResilientUserRateThrottle):
    scope = "blog_post"
    rate = "10/minute"


class CommentThrottle(ResilientAnonRateThrottle):
    # Comments are AllowAny — throttle by IP
    scope = "comment"
    rate = "10/minute"


class ChangePasswordThrottle(ResilientUserRateThrottle):
    scope = "password_change"
    rate = "5/minute"
