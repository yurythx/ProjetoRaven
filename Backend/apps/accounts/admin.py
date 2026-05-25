"""
Admin configuration for accounts app.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import User, TOTPRecoveryCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom admin for User model."""

    list_display = [
        "email",
        "username",
        "display_name",
        "is_active",
        "is_banned",
        "is_verified",
        "is_staff",
        "is_superuser",
        "date_joined",
    ]
    list_filter = [
        "is_active",
        "is_banned",
        "is_verified",
        "is_staff",
        "is_superuser",
        "groups",
        "gender",
        "date_joined",
    ]
    search_fields = ["email", "username", "display_name"]
    ordering = ["-date_joined"]

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (
            "Personal Info",
            {"fields": ("email", "display_name", "birth_date", "gender")},
        ),
        (
            "Status",
            {"fields": ("is_active", "is_banned", "is_verified")},
        ),
        (
            "Permissions",
            {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        (
            "Ban Info",
            {"fields": ("ban_reason", "banned_at", "banned_by")},
        ),
        (
            "Verification",
            {"fields": ("verification_token", "verification_token_created_at")},
        ),
        (
            "Two-Factor Auth",
            {"fields": ("totp_enabled",)},
        ),
        (
            "Security",
            {"fields": ("last_password_change", "last_login_ip", "registration_ip")},
        ),
        (
            "Important dates",
            {"fields": ("last_login", "date_joined")},
        ),
    )
    readonly_fields = [
        "uuid",
        "ban_reason",
        "banned_at",
        "banned_by",
        "verification_token",
        "verification_token_created_at",
        "last_password_change",
        "last_login_ip",
        "registration_ip",
    ]

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "password1",
                    "password2",
                    "display_name",
                    "is_active",
                    "is_staff",
                ),
            },
        ),
    )

    actions = ["ban_users", "unban_users", "activate_users", "deactivate_users"]

    def ban_users(self, request, queryset):
        count = 0
        for user in queryset.filter(is_superuser=False):
            user.ban(reason="Banned by admin action", banned_by=request.user)
            count += 1
        self.message_user(request, f"{count} user(s) banned.")

    ban_users.short_description = "Ban selected users"

    def unban_users(self, request, queryset):
        count = queryset.filter(is_banned=True).update(is_banned=False, is_active=True)
        self.message_user(request, f"{count} user(s) unbanned.")

    unban_users.short_description = "Unban selected users"

    def activate_users(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count} user(s) activated.")

    activate_users.short_description = "Activate selected users"

    def deactivate_users(self, request, queryset):
        count = queryset.filter(is_superuser=False).update(is_active=False)
        self.message_user(request, f"{count} user(s) deactivated.")

    deactivate_users.short_description = "Deactivate selected users"


class TOTPRecoveryCodeInline(admin.TabularInline):
    model = TOTPRecoveryCode
    extra = 0
    readonly_fields = ["code_hash", "created_at", "used_at"]
    can_delete = True
    verbose_name = "Recovery Code"
    verbose_name_plural = "Recovery Codes"
    ordering = ["created_at"]


@admin.register(TOTPRecoveryCode)
class TOTPRecoveryCodeAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at", "used_at", "is_used"]
    list_filter = ["used_at", "created_at"]
    search_fields = ["user__email", "user__username"]
    ordering = ["-created_at"]
    readonly_fields = ["user", "code_hash", "created_at", "used_at"]

    actions = ["invalidate_codes"]

    @admin.display(boolean=True, description="Used")
    def is_used(self, obj):
        return obj.used_at is not None

    def invalidate_codes(self, request, queryset):
        from django.utils import timezone
        count = queryset.filter(used_at__isnull=True).update(used_at=timezone.now())
        self.message_user(request, f"{count} code(s) invalidated.")

    invalidate_codes.short_description = "Invalidate selected codes"

    def has_add_permission(self, request):
        return False


UserAdmin.inlines = [TOTPRecoveryCodeInline]
