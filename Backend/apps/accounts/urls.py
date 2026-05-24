"""
URL routes for accounts app.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenVerifyView

from .api.auth import (
    RegisterView,
    VerifyEmailView,
    ResendEmailVerificationView,
    LoginView,
    LogoutView,
)
from .api.profile import (
    MeView,
    ProfileView,
    UnityTokenView,
    PublicProfileView,
    DeleteAccountView,
    ChangeUsernameView,
    AvatarUploadView,
)
from .api.password import (
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)
from .api.smtp import (
    SMTPSettingsView,
    SMTPHealthView,
    SMTPTestEmailView,
)
from .api.analytics import AdminAnalyticsView
from .api.diagnostics import AdminDiagnosticsView
from .api.user_admin import UserViewSet
from .api.audit import AdminAuditEventViewSet
from .api.social import (
    FriendshipView,
    FriendshipActionView,
)
from .api.jwt import SafeTokenRefreshView
from .api.totp import (
    TOTP2FASetupView,
    TOTP2FAEnableView,
    TOTP2FADisableView,
    TOTP2FAVerifyView,
    TOTP2FARecoveryCodesView,
)
from .api.oauth import OAuthInitView, OAuthCallbackView, ConnectedAccountsView
from .api.oauth_admin import OAuthProviderSettingsView
from .api.push import PushSubscribeView, VapidPublicKeyView

app_name = "accounts"

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"audit-events", AdminAuditEventViewSet, basename="admin-audit-event")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("email/verify/", VerifyEmailView.as_view(), name="email_verify"),
    path("email/verify/resend/", ResendEmailVerificationView.as_view(), name="email_verify_resend"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", SafeTokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("me/", MeView.as_view(), name="me"),
    path("smtp-settings/", SMTPSettingsView.as_view(), name="smtp_settings"),
    path("smtp-settings/health/", SMTPHealthView.as_view(), name="smtp_settings_health"),
    path("smtp-settings/test/", SMTPTestEmailView.as_view(), name="smtp_settings_test"),
    path("admin/analytics/", AdminAnalyticsView.as_view(), name="admin_analytics"),
    path("admin/diagnostics/", AdminDiagnosticsView.as_view(), name="admin_diagnostics"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("unity-token/", UnityTokenView.as_view(), name="unity_token"),
    path("friends/", FriendshipView.as_view(), name="friendships"),
    path("friends/<uuid:friendship_id>/", FriendshipActionView.as_view(), name="friendship-action"),
    path("2fa/setup/", TOTP2FASetupView.as_view(), name="2fa_setup"),
    path("2fa/enable/", TOTP2FAEnableView.as_view(), name="2fa_enable"),
    path("2fa/disable/", TOTP2FADisableView.as_view(), name="2fa_disable"),
    path("2fa/verify/", TOTP2FAVerifyView.as_view(), name="2fa_verify"),
    path("2fa/recovery-codes/", TOTP2FARecoveryCodesView.as_view(), name="2fa_recovery_codes"),
    path("oauth/connected/", ConnectedAccountsView.as_view(), name="oauth_connected"),
    path("oauth/<str:provider>/", OAuthInitView.as_view(), name="oauth_init"),
    path("oauth/<str:provider>/callback/", OAuthCallbackView.as_view(), name="oauth_callback"),
    path("admin/oauth-providers/", OAuthProviderSettingsView.as_view(), name="oauth_providers_list"),
    path("admin/oauth-providers/<str:provider>/", OAuthProviderSettingsView.as_view(), name="oauth_providers_detail"),
    path("push/subscribe/", PushSubscribeView.as_view(), name="push_subscribe"),
    path("push/vapid-public-key/", VapidPublicKeyView.as_view(), name="push_vapid_public_key"),
    path("delete-account/", DeleteAccountView.as_view(), name="delete_account"),
    path("change-username/", ChangeUsernameView.as_view(), name="change_username"),
    path("avatar/", AvatarUploadView.as_view(), name="avatar"),
    path("public/<str:username>/", PublicProfileView.as_view(), name="public_profile"),
    path("", include(router.urls)),
]
