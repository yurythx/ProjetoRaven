from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle

from ..services.auth import AuthService
from ..services.profile import ProfileService
from ..serializers.auth import (
    ChangePasswordSerializer,
    PasswordResetCodeRequestSerializer,
    PasswordResetCodeConfirmSerializer,
)
from ..permissions import IsNotBanned
from apps.common.utils import get_ip_and_ua
from apps.common.throttling import ChangePasswordThrottle, PasswordResetThrottle


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]
    throttle_classes = [ChangePasswordThrottle]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ProfileService().change_own_password(
                user=request.user,
                current_password=serializer.validated_data["current_password"],
                new_password=serializer.validated_data["new_password"],
            )
            return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetCodeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        ip_address, user_agent = get_ip_and_ua(request)
        
        AuthService().request_password_reset(email, ip_address, user_agent)
        
        return Response({"detail": "OK"}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetCodeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]
        ip_address, user_agent = get_ip_and_ua(request)

        try:
            AuthService().confirm_password_reset(email, code, new_password, ip_address, user_agent)
            return Response({"detail": "OK"}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
