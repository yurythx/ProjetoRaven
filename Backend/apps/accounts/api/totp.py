"""
TOTP 2FA endpoints.

Flow:
  1. POST /2fa/setup/             → returns secret + QR code
  2. POST /2fa/enable/            → verifies code and enables 2FA
  3. POST /2fa/disable/           → disables 2FA (requires valid TOTP code)
  4. POST /2fa/recovery-codes/    → generate a fresh set of 8 recovery codes (requires 2FA enabled)

Login flow when 2FA is active:
  - POST /login/        → returns {"totp_required": true, "totp_token": "<signed>"}
  - POST /2fa/verify/   → verifies TOTP code OR recovery code + partial token → returns full JWT
"""
from io import BytesIO
from base64 import b64encode

from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ..serializers.user import UserProfileSerializer
from ..utils.encryption import encrypt_totp_secret, decrypt_totp_secret

TOTP_ISSUER = "ProjetoRaven"
PARTIAL_TOKEN_MAX_AGE = 300  # 5 minutes


class TOTP2FASetupView(APIView):
    """Generate TOTP secret and QR code. Resets any existing unconfirmed secret."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.totp_enabled:
            return Response(
                {"detail": "2FA já está ativado. Desative-o primeiro."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import pyotp
        import qrcode
        secret = pyotp.random_base32()
        user.totp_secret = encrypt_totp_secret(secret)
        user.save(update_fields=["totp_secret"])

        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=user.email, issuer_name=TOTP_ISSUER)

        img = qrcode.make(uri)
        buf = BytesIO()
        img.save(buf, format="PNG")
        qr_b64 = b64encode(buf.getvalue()).decode()

        return Response({
            "secret": secret,
            "uri": uri,
            "qr_code": f"data:image/png;base64,{qr_b64}",
        })


class TOTP2FAEnableView(APIView):
    """Confirm setup by verifying the first TOTP code. Enables 2FA on success."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        code = str(request.data.get("code", "")).strip()

        if user.totp_enabled:
            return Response(
                {"detail": "2FA já está ativado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.totp_secret:
            return Response(
                {"detail": "Execute o setup (POST /2fa/setup/) primeiro."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import hashlib
        import secrets
        import pyotp
        from ..models import TOTPRecoveryCode

        totp = pyotp.TOTP(decrypt_totp_secret(user.totp_secret))
        if not totp.verify(code, valid_window=1):
            return Response({"detail": "Código inválido."}, status=status.HTTP_400_BAD_REQUEST)

        user.totp_enabled = True
        user.save(update_fields=["totp_enabled"])

        codes = [secrets.token_hex(5).upper() for _ in range(8)]
        TOTPRecoveryCode.objects.filter(user=user).delete()
        TOTPRecoveryCode.objects.bulk_create([
            TOTPRecoveryCode(
                user=user,
                code_hash=hashlib.sha256(c.encode()).hexdigest(),
            )
            for c in codes
        ])

        return Response({
            "detail": "2FA ativado com sucesso.",
            "recovery_codes": codes,
        })


class TOTP2FADisableView(APIView):
    """Disable 2FA. Requires a valid TOTP code to prevent unauthorized deactivation."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        code = str(request.data.get("code", "")).strip()

        if not user.totp_enabled:
            return Response(
                {"detail": "2FA não está ativado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import pyotp
        totp = pyotp.TOTP(decrypt_totp_secret(user.totp_secret))
        if not totp.verify(code, valid_window=1):
            return Response({"detail": "Código inválido."}, status=status.HTTP_400_BAD_REQUEST)

        user.totp_enabled = False
        user.totp_secret = ""
        user.save(update_fields=["totp_enabled", "totp_secret"])
        return Response({"detail": "2FA desativado com sucesso."})


class TOTP2FAVerifyView(APIView):
    """
    Second step of login when 2FA is enabled.
    Accepts the partial token issued by /login/ + the TOTP code.
    Returns full JWT on success.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        partial_token = str(request.data.get("totp_token", "")).strip()
        code = str(request.data.get("code", "")).strip()

        if not partial_token or not code:
            return Response(
                {"detail": "totp_token e code são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        signer = TimestampSigner()
        try:
            user_id = signer.unsign(partial_token, max_age=PARTIAL_TOKEN_MAX_AGE)
        except SignatureExpired:
            return Response(
                {"detail": "Token expirado. Faça login novamente."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except BadSignature:
            return Response({"detail": "Token inválido."}, status=status.HTTP_401_UNAUTHORIZED)

        from django.contrib.auth import get_user_model
        from ..utils.lockout import is_locked_out, record_failure, clear_failures
        User = get_user_model()
        user = User.objects.filter(id=user_id, is_active=True, totp_enabled=True).first()
        if not user:
            return Response({"detail": "Usuário inválido."}, status=status.HTTP_401_UNAUTHORIZED)

        totp_key = f"totp:{user_id}"
        if is_locked_out(totp_key):
            return Response(
                {"detail": "Conta temporariamente bloqueada. Tente novamente mais tarde."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        import pyotp
        totp = pyotp.TOTP(decrypt_totp_secret(user.totp_secret))
        if totp.verify(code, valid_window=1):
            clear_failures(totp_key)
        else:
            # Try recovery code fallback
            if not self._try_recovery_code(user, code):
                record_failure(totp_key)
                return Response({"detail": "Código inválido."}, status=status.HTTP_400_BAD_REQUEST)
            clear_failures(totp_key)

        refresh = RefreshToken.for_user(user)
        return Response({
            "user": UserProfileSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
        })

    @staticmethod
    def _try_recovery_code(user, code: str) -> bool:
        """Attempt to consume a recovery code. Returns True if valid."""
        import hashlib
        from django.utils import timezone
        from ..models import TOTPRecoveryCode
        code_hash = hashlib.sha256(code.strip().upper().encode()).hexdigest()
        rc = TOTPRecoveryCode.objects.filter(user=user, code_hash=code_hash, used_at__isnull=True).first()
        if rc:
            rc.used_at = timezone.now()
            rc.save(update_fields=["used_at"])
            return True
        return False


class TOTP2FARecoveryCodesView(APIView):
    """Generate a fresh set of 8 one-time recovery codes. Invalidates all previous ones."""
    permission_classes = [permissions.IsAuthenticated]

    BATCH_SIZE = 8

    def post(self, request):
        import hashlib
        import secrets
        from ..models import TOTPRecoveryCode

        user = request.user
        if not user.totp_enabled:
            return Response(
                {"detail": "2FA não está ativado. Ative o 2FA antes de gerar códigos de recuperação."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        codes = [secrets.token_hex(5).upper() for _ in range(self.BATCH_SIZE)]

        TOTPRecoveryCode.objects.filter(user=user).delete()
        TOTPRecoveryCode.objects.bulk_create([
            TOTPRecoveryCode(
                user=user,
                code_hash=hashlib.sha256(c.encode()).hexdigest(),
            )
            for c in codes
        ])

        return Response({
            "codes": codes,
            "detail": "Guarde estes códigos em local seguro. Eles não serão mostrados novamente.",
        })
