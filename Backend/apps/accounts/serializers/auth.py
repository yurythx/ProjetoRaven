from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.accounts.validators import CustomValidators
from .utils import extract_request_ip_user_agent

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )
    birth_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "password",
            "password_confirm",
            "display_name",
            "birth_date",
            "gender",
        ]
        extra_kwargs = {
            "display_name": {"required": False},
            "gender": {"required": False},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )

        try:
            CustomValidators.validate_password(attrs["password"])
        except Exception as e:
            raise serializers.ValidationError({"password": str(e.message) if hasattr(e, "message") else str(e)})

        if "birth_date" in attrs and attrs["birth_date"]:
            try:
                attrs["birth_date"] = CustomValidators.validate_birth_date(attrs["birth_date"])
            except Exception as e:
                raise serializers.ValidationError({"birth_date": str(e)})

        return attrs

    def create(self, validated_data):
        from apps.accounts.services import AuthService

        password = validated_data.pop("password")
        request = self.context.get("request")
        ip_address, user_agent = extract_request_ip_user_agent(request)

        user = AuthService().register_user(
            email=validated_data["email"],
            username=validated_data["username"],
            password=password,
            display_name=validated_data.get("display_name"),
            birth_date=validated_data.get("birth_date"),
            gender=validated_data.get("gender"),
            registration_ip=ip_address,
            user_agent=user_agent,
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )
    def validate(self, attrs):
        from apps.accounts.services import AuthService
        from ..utils.lockout import is_locked_out, record_failure, clear_failures

        raw_email = attrs["email"]
        raw_password = attrs["password"]

        if is_locked_out(raw_email):
            raise serializers.ValidationError(
                "Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde."
            )

        candidate = User.objects.filter(email__iexact=raw_email).first()
        if candidate and candidate.check_password(raw_password):
            if candidate.is_banned:
                raise serializers.ValidationError("Sua conta está banida.")
            if not candidate.is_verified and not candidate.is_admin_verified and not candidate.is_staff and not candidate.is_superuser:
                raise serializers.ValidationError("Confirme seu e-mail antes de entrar.")
            if not candidate.is_active:
                raise serializers.ValidationError("Sua conta está desativada.")

        user = AuthService().authenticate(
            email=raw_email,
            password=raw_password,
            ip_address=self.context.get("ip_address"),
        )

        if not user:
            record_failure(raw_email)
            raise serializers.ValidationError("Invalid email or password.")

        clear_failures(raw_email)
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "New passwords do not match."}
            )

        try:
            CustomValidators.validate_password(attrs["new_password"])
        except Exception as e:
            raise serializers.ValidationError({"new_password": str(e)})

        return attrs


class EmailVerifySerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.RegexField(regex=r"^\d{6}$", required=True)


class EmailResendSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetCodeRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetCodeConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.RegexField(regex=r"^\d{6}$", required=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        try:
            return CustomValidators.validate_password(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
