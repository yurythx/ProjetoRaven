from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import serializers
from apps.accounts.validators import CustomValidators
from .utils import extract_request_ip_user_agent

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile (read-only)."""

    groups = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    is_blog_editor = serializers.SerializerMethodField()
    is_forum_moderator = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "uuid",
            "email",
            "username",
            "display_name",
            "bio",
            "website",
            "birth_date",
            "gender",
            "avatar_url",
            "is_verified",
            "is_admin_verified",
            "is_banned",
            "is_staff",
            "is_superuser",
            "is_member",
            "is_admin",
            "is_blog_editor",
            "is_forum_moderator",
            "last_login_ip",
            "date_joined",
            "last_login",
            "groups",
            "permissions",
            "totp_enabled",
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        from django.conf import settings
        from apps.common.utils import build_media_url
        relative = f"{settings.MEDIA_URL}{obj.avatar.name}"
        return build_media_url(relative, self.context.get("request"))

    def get_groups(self, obj):
        return [g.name for g in obj.groups.all()]

    def get_permissions(self, obj):
        return list(obj.get_all_permissions())

    def get_is_member(self, obj):
        return obj.is_member

    def get_is_admin(self, obj):
        return obj.is_admin

    def get_is_blog_editor(self, obj):
        return obj.is_blog_editor

    def get_is_forum_moderator(self, obj):
        return obj.is_forum_moderator


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating own profile."""

    class Meta:
        model = User
        fields = ["display_name", "bio", "website", "birth_date", "gender"]

    def validate_birth_date(self, value):
        if value:
            try:
                return CustomValidators.validate_birth_date(value)
            except Exception as e:
                raise serializers.ValidationError(str(e))
        return value

    def update(self, instance, validated_data):
        from apps.accounts.services import UserProfileService

        return UserProfileService().update_own_profile(instance, validated_data)


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for admin user list."""

    groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "uuid",
            "email",
            "username",
            "display_name",
            "is_active",
            "is_banned",
            "is_verified",
            "is_staff",
            "is_superuser",
            "groups",
            "date_joined",
            "last_login",
        ]
        read_only_fields = fields

    def get_groups(self, obj):
        return [g.name for g in obj.groups.all()]


class UserAdminSerializer(serializers.ModelSerializer):
    """Serializer for admin user management."""

    groups = serializers.SlugRelatedField(
        slug_field="name",
        many=True,
        queryset=Group.objects.all(),
        required=False,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "uuid",
            "email",
            "username",
            "display_name",
            "is_active",
            "is_banned",
            "is_verified",
            "is_staff",
            "is_superuser",
            "groups",
            "birth_date",
            "gender",
            "ban_reason",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "uuid", "date_joined", "last_login", "ban_reason"]

    def validate_birth_date(self, value):
        if value:
            try:
                return CustomValidators.validate_birth_date(value)
            except Exception as e:
                raise serializers.ValidationError(str(e))
        return value

    def update(self, instance, validated_data):
        from apps.accounts.services import UserManagementService

        request = self.context.get("request")
        ip_address, user_agent = extract_request_ip_user_agent(request)

        groups_data = validated_data.pop("groups", None)

        if groups_data is not None:
            UserManagementService().change_user_groups(
                instance,
                [g.name for g in groups_data],
                self.context["request"].user,
                ip_address=ip_address,
                user_agent=user_agent,
            )

        return UserManagementService().update_user(
            instance,
            validated_data,
            self.context["request"].user,
            ip_address=ip_address,
            user_agent=user_agent,
        )


class UserAdminCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    username = serializers.CharField(required=True, min_length=3, max_length=150)
    password = serializers.CharField(required=True, write_only=True, style={"input_type": "password"})
    display_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)
    is_staff = serializers.BooleanField(required=False)
    groups = serializers.ListField(child=serializers.CharField(), required=False)

    def validate_password(self, value):
        try:
            return CustomValidators.validate_password(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))

    def create(self, validated_data):
        from apps.accounts.services import AdminAuditService, UserManagementService

        request = self.context.get("request")
        ip_address, user_agent = extract_request_ip_user_agent(request)

        groups = validated_data.pop("groups", None)
        password = validated_data.pop("password")
        display_name = validated_data.pop("display_name", None)
        is_staff = bool(validated_data.pop("is_staff", False))

        user = User.objects.create_user(password=password, **validated_data)
        if display_name is not None:
            user.display_name = display_name
            user.save(update_fields=["display_name"])

        if is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        if groups is not None:
            UserManagementService().change_user_groups(
                user,
                groups,
                self.context["request"].user,
                ip_address=ip_address,
                user_agent=user_agent,
            )

        AdminAuditService.record(
            action="create_user",
            actor=self.context["request"].user,
            target=user,
            metadata={},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return user

    def to_representation(self, instance):
        return UserAdminSerializer(instance, context=self.context).data


class UserUUIDSerializer(serializers.Serializer):
    """Serializer for user lookup by UUID."""

    uuid = serializers.UUIDField(required=True)
