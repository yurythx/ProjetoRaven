"""OAuth 2.0 endpoints for Google and Discord.

Flow:
  1. GET  /oauth/{provider}/        → { auth_url, state }
  2. POST /oauth/{provider}/callback/ with { code, state, redirect_uri }
                                    → { access, refresh, user, created }

The `state` is a HMAC-signed value (TimestampSigner) to prevent CSRF.
"""
import logging

from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import SocialAccount
from ..services import oauth as oauth_service
from ..serializers.user import UserProfileSerializer

logger = logging.getLogger(__name__)

_STATE_MAX_AGE = 600  # 10 minutes
_PROVIDERS = {
    "google":  (oauth_service.google_auth_url,  oauth_service.google_exchange_code),
    "discord": (oauth_service.discord_auth_url, oauth_service.discord_exchange_code),
}


class OAuthInitView(APIView):
    """Step 1 — return the provider authorization URL."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, provider):
        if provider not in _PROVIDERS:
            return Response({"error": f"Unknown provider: {provider}"}, status=status.HTTP_400_BAD_REQUEST)

        redirect_uri = request.query_params.get("redirect_uri", "")
        if not redirect_uri:
            return Response({"error": "redirect_uri required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            build_url, _ = _PROVIDERS[provider]
            raw_state = oauth_service.generate_state()
            signed_state = TimestampSigner().sign(raw_state)
            auth_url = build_url(redirect_uri, signed_state)
            return Response({"auth_url": auth_url, "state": signed_state})
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class OAuthCallbackView(APIView):
    """Step 2 — exchange code for JWT tokens."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, provider):
        if provider not in _PROVIDERS:
            return Response({"error": f"Unknown provider: {provider}"}, status=status.HTTP_400_BAD_REQUEST)

        code         = request.data.get("code", "").strip()
        state        = request.data.get("state", "").strip()
        redirect_uri = request.data.get("redirect_uri", "").strip()

        if not code or not state or not redirect_uri:
            return Response({"error": "code, state and redirect_uri are required"}, status=status.HTTP_400_BAD_REQUEST)

        # Verify state
        try:
            TimestampSigner().unsign(state, max_age=_STATE_MAX_AGE)
        except SignatureExpired:
            return Response({"error": "OAuth state expired — please try again"}, status=status.HTTP_400_BAD_REQUEST)
        except BadSignature:
            return Response({"error": "Invalid OAuth state"}, status=status.HTTP_400_BAD_REQUEST)

        # Exchange code for user info
        _, exchange_code = _PROVIDERS[provider]
        try:
            user_info = exchange_code(code, redirect_uri)
        except Exception as exc:
            logger.warning("OAuth %s code exchange failed: %s", provider, exc)
            return Response({"error": "Failed to verify OAuth token with provider"}, status=status.HTTP_502_BAD_GATEWAY)

        # Find or create user
        try:
            user, created = oauth_service.get_or_create_user(provider, user_info)
        except Exception as exc:
            logger.error("OAuth get_or_create_user failed: %s", exc)
            return Response({"error": "Account creation failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if user.is_banned:
            return Response({"error": "Your account has been banned"}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
            "user":    UserProfileSerializer(user).data,
            "created": created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConnectedAccountsView(APIView):
    """List OAuth providers connected to the authenticated user's account."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        accounts = SocialAccount.objects.filter(user=request.user).values(
            "id", "provider", "provider_uid", "created_at"
        )
        return Response(list(accounts))
