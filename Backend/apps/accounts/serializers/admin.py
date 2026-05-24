from rest_framework import serializers
from apps.accounts.models import AdminAuditEvent, SMTPSettings
from apps.accounts.validators import CustomValidators

class SMTPSettingsSerializer(serializers.ModelSerializer):
    password = serializers.CharField(required=False, write_only=True, allow_blank=True, style={"input_type": "password"})
    password_set = serializers.SerializerMethodField()

    class Meta:
        model = SMTPSettings
        fields = [
            "is_enabled",
            "host",
            "port",
            "username",
            "password",
            "password_set",
            "use_tls",
            "use_ssl",
            "timeout",
            "from_email",
            "from_name",
            "reply_to",
        ]

    def get_password_set(self, obj):
        return bool(obj.password_encrypted)

    def update(self, instance, validated_data):
        from apps.accounts.emailing import encrypt_secret

        password = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password is not None and str(password).strip():
            instance.password_encrypted = encrypt_secret(str(password))
        instance.save()
        return instance


class SMTPTestEmailSerializer(serializers.Serializer):
    to_email = serializers.EmailField(required=True)


class AdminAuditEventSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()

    class Meta:
        model = AdminAuditEvent
        fields = ["id", "created_at", "action", "actor", "target", "metadata", "ip_address", "user_agent"]
        read_only_fields = fields

    def get_actor(self, obj):
        if not obj.actor_id:
            return None
        a = obj.actor
        return {"id": str(a.id), "email": a.email, "username": a.username, "display_name": a.display_name}

    def get_target(self, obj):
        t = obj.target
        return {"id": str(t.id), "email": t.email, "username": t.username, "display_name": t.display_name}


class BanUserSerializer(serializers.Serializer):
    """Serializer for banning a user."""

    reason = serializers.CharField(
        required=True,
        min_length=10,
        max_length=1000,
    )

    def validate_reason(self, value):
        try:
            return CustomValidators.validate_ban_reason(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for admin password reset."""

    new_password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )

    def validate_new_password(self, value):
        try:
            CustomValidators.validate_password(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
