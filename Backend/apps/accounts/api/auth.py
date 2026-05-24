import logging

from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

logger = logging.getLogger(__name__)

from ..services.auth import AuthService
from ..serializers.auth import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    EmailVerifySerializer,
    EmailResendSerializer,
)
from ..serializers.user import UserProfileSerializer
from apps.common.utils import get_ip_and_ua
from apps.common.throttling import LoginThrottle, RegistrationThrottle, EmailVerificationThrottle


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, RegistrationThrottle]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        ip_address, user_agent = get_ip_and_ua(request)
        AuthService().send_verification_email(user, ip_address, user_agent, resend=False)
        
        return Response(
            {"verification_required": True, "email": user.email}, 
            status=status.HTTP_201_CREATED
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, EmailVerificationThrottle]

    def post(self, request):
        serializer = EmailVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        ip_address, user_agent = get_ip_and_ua(request)

        try:
            user = AuthService().verify_email(email, code, ip_address, user_agent)
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "user": UserProfileSerializer(user).data,
                    "tokens": {"refresh": str(refresh), "access": str(refresh.access_token)},
                },
                status=status.HTTP_200_OK,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ResendEmailVerificationView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, EmailVerificationThrottle]

    def post(self, request):
        serializer = EmailResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email).first()

        if user and not user.is_verified:
            ip_address, user_agent = get_ip_and_ua(request)
            AuthService().send_verification_email(user, ip_address, user_agent, resend=True)

        return Response({"detail": "OK"}, status=status.HTTP_200_OK)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, LoginThrottle]

    def post(self, request):
        ip_address, _ = get_ip_and_ua(request)
        serializer = UserLoginSerializer(data=request.data, context={"ip_address": ip_address})
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        if user.totp_enabled:
            from django.core.signing import TimestampSigner
            partial_token = TimestampSigner().sign(str(user.id))
            return Response(
                {"totp_required": True, "totp_token": partial_token},
                status=status.HTTP_200_OK,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserProfileSerializer(user).data,
                "tokens": {"refresh": str(refresh), "access": str(refresh.access_token)},
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                RefreshToken(refresh_token).blacklist()
            return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)
