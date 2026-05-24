from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.mail import get_connection

from ..models import SMTPSettings
from ..serializers.admin import SMTPSettingsSerializer, SMTPTestEmailSerializer

class SMTPSettingsView(APIView):
    """SMTP configuration for transactional emails."""
    permission_classes = [permissions.IsAdminUser]

    def _get_or_create_cfg(self):
        cfg = SMTPSettings.objects.order_by("-updated_at").first()
        if not cfg:
            cfg = SMTPSettings.objects.create()
        return cfg

    def get(self, request):
        return Response(SMTPSettingsSerializer(self._get_or_create_cfg()).data)

    def put(self, request):
        cfg = self._get_or_create_cfg()
        serializer = SMTPSettingsSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(SMTPSettingsSerializer(serializer.save()).data)

class SMTPTestEmailView(APIView):
    """Send a test email to verify SMTP config."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        serializer = SMTPTestEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.accounts.emailing import send_email
        send_email(
            to_email=serializer.validated_data["to_email"],
            subject="Teste de SMTP",
            body="Este é um e-mail de teste do Projeto Raven.",
        )
        return Response({"detail": "OK"}, status=status.HTTP_200_OK)

class SMTPHealthView(APIView):
    """Check whether the SMTP connection is healthy."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        cfg = SMTPSettings.objects.order_by("-updated_at").first()
        if not cfg or not cfg.is_enabled or not cfg.host:
            return Response({"status": "disabled"}, status=status.HTTP_200_OK)

        try:
            conn = get_connection()
            conn.open()
            conn.close()
            return Response({"status": "ok"}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"status": "degraded"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
