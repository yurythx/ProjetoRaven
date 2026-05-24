"""
Custom permissions for forum app.
"""
from rest_framework import permissions


class IsForumModerator(permissions.BasePermission):
    """Permission for forum moderators."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_active_and_not_banned
            and (request.user.is_verified or request.user.is_admin_verified)
            and (request.user.is_forum_moderator or request.user.is_admin)
        )


class IsTopicAuthorOrModerator(permissions.BasePermission):
    """Permission for topic author or moderator."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_active_and_not_banned or not (request.user.is_verified or request.user.is_admin_verified):
            return False
        if request.user.is_forum_moderator or request.user.is_admin:
            return True
        return obj.author == request.user


class IsReplyAuthorOrModerator(permissions.BasePermission):
    """Permission for reply author or moderator."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_active_and_not_banned or not (request.user.is_verified or request.user.is_admin_verified):
            return False
        if request.user.is_forum_moderator or request.user.is_admin:
            return True
        return obj.author == request.user


class CanCreateTopic(permissions.BasePermission):
    """Permission to create topics."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_active_and_not_banned
            and (request.user.is_verified or request.user.is_admin_verified)
            and (request.user.is_player or request.user.is_forum_moderator or request.user.is_admin)
        )


class CanCreateReply(permissions.BasePermission):
    """Permission to create replies."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_active_and_not_banned
            and (request.user.is_verified or request.user.is_admin_verified)
            and (request.user.is_player or request.user.is_forum_moderator or request.user.is_admin)
        )
