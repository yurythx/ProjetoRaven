from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


class LoginThrottle(AnonRateThrottle):
    # Login is pre-auth: key by IP, not user ID
    scope = "login"
    rate = "10/min"


class RegistrationThrottle(AnonRateThrottle):
    scope = "register"
    rate = "3/hour"


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"
    rate = "3/hour"


class EmailVerificationThrottle(AnonRateThrottle):
    scope = "otp"
    rate = "5/minute"


class ForumPostThrottle(UserRateThrottle):
    scope = "forum_post"
    rate = "20/minute"


class BlogPostThrottle(UserRateThrottle):
    scope = "blog_post"
    rate = "10/minute"


class CommentThrottle(AnonRateThrottle):
    # Comments are AllowAny — throttle by IP
    scope = "comment"
    rate = "10/minute"


class ChangePasswordThrottle(UserRateThrottle):
    scope = "password_change"
    rate = "5/minute"
