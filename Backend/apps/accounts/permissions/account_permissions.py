from rest_framework import permissions


def _authenticated_and_active(request):
    return (
        request.user
        and request.user.is_authenticated
        and request.user.is_active_and_not_banned
    )


def _fully_verified(user):
    return user.is_verified or user.is_admin_verified


class IsPlayer(permissions.BasePermission):
    """Allows access only to active, non-banned players."""

    def has_permission(self, request, view):
        return _authenticated_and_active(request) and request.user.is_player


class IsBlogEditor(permissions.BasePermission):
    """Allows access only to active, non-banned blog editors."""

    def has_permission(self, request, view):
        return _authenticated_and_active(request) and request.user.is_blog_editor


class IsForumModerator(permissions.BasePermission):
    """Allows access only to active, non-banned forum moderators."""

    def has_permission(self, request, view):
        return _authenticated_and_active(request) and request.user.is_forum_moderator


class IsAdmin(permissions.BasePermission):
    """Allows access only to admins (staff or superuser)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
        )


class IsSuperUser(permissions.BasePermission):
    """Allows access only to superusers."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """Admin has full access, others read-only."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_admin


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allows access to the owner or admin."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_admin:
            return True
        if hasattr(obj, "owner"):
            return obj.owner == request.user
        if hasattr(obj, "user"):
            return obj.user == request.user
        return obj == request.user


class IsOwnerOnly(permissions.BasePermission):
    """Allows access only to the owner."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, "owner"):
            return obj.owner == request.user
        if hasattr(obj, "user"):
            return obj.user == request.user
        return obj == request.user


class IsNotBanned(permissions.BasePermission):
    """Allows access only to non-banned users."""

    def has_permission(self, request, view):
        return _authenticated_and_active(request)


class IsVerified(permissions.BasePermission):
    """Allows access only to email-verified users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_verified
        )


class IsAdminVerified(permissions.BasePermission):
    """Allows access only to admin-verified users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_admin_verified
        )


class IsFullyVerified(permissions.BasePermission):
    """Allows access only to users verified by either email or admin."""

    def has_permission(self, request, view):
        return _authenticated_and_active(request) and _fully_verified(request.user)


class IsGameUser(permissions.BasePermission):
    """Allows access to players who are verified (Email or Admin)."""

    def has_permission(self, request, view):
        return (
            _authenticated_and_active(request)
            and _fully_verified(request.user)
            and request.user.is_player
        )


class AllowAnyForRegistration(permissions.BasePermission):
    """Allow anyone to register, but require auth for other actions."""

    def has_permission(self, request, view):
        if request.method == "POST" and view.action in ["create", "register"]:
            return True
        return request.user and request.user.is_authenticated


class CanModerateForum(permissions.BasePermission):
    """Permission for forum moderation actions. Admins or Forum Moderators."""

    def has_permission(self, request, view):
        if not _authenticated_and_active(request):
            return False
        if not _fully_verified(request.user):
            return False
        return request.user.is_forum_moderator or request.user.is_admin


class CanEditBlog(permissions.BasePermission):
    """Permission for blog editing actions. Admins or Blog Editors."""

    def has_permission(self, request, view):
        if not _authenticated_and_active(request):
            return False
        if not _fully_verified(request.user):
            return False
        return request.user.is_blog_editor or request.user.is_admin
