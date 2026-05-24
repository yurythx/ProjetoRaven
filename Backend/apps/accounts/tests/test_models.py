"""
Tests for User model.
"""
import uuid
from datetime import date

from django.test import TestCase

from apps.accounts.models import User


class UserModelTestCase(TestCase):
    """Test cases for User model."""

    def setUp(self):
        self.user_data = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "TestPass123!",
            "display_name": "Test User",
        }

    def test_create_user(self):
        user = User.objects.create_user(**self.user_data)
        self.assertIsNotNone(user.id)
        self.assertIsInstance(user.id, uuid.UUID)
        self.assertEqual(user.email, "test@example.com")
        self.assertEqual(user.username, "testuser")
        self.assertTrue(user.check_password("TestPass123!"))

    def test_create_user_without_email_raises_error(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(
                email="",
                username="testuser",
                password="TestPass123!"
            )

    def test_create_user_without_username_raises_error(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(
                email="test@example.com",
                username="",
                password="TestPass123!"
            )

    def test_create_superuser(self):
        superuser = User.objects.create_superuser(
            email="admin@example.com",
            username="admin",
            password="AdminPass123!"
        )
        self.assertTrue(superuser.is_staff)
        self.assertTrue(superuser.is_superuser)

    def test_user_str_with_display_name(self):
        user = User.objects.create_user(**self.user_data)
        self.assertEqual(str(user), "Test User")

    def test_user_str_without_explicit_display_name(self):
        user = User.objects.create_user(
            email="test@example.com",
            username="testuser",
            password="TestPass123!"
        )
        self.assertEqual(str(user), "testuser")

    def test_is_player_property(self):
        user = User.objects.create_user(**self.user_data)
        self.assertFalse(user.is_player)

        from django.contrib.auth.models import Group
        player_group = Group.objects.create(name="players")
        user.groups.add(player_group)
        del user.__dict__["is_player"]  # clear cached_property
        self.assertTrue(user.is_player)

    def test_ban_user(self):
        user = User.objects.create_user(**self.user_data)
        admin = User.objects.create_superuser(
            email="admin@example.com",
            username="admin",
            password="AdminPass123!"
        )

        user.ban(reason="Test ban", banned_by=admin)

        self.assertTrue(user.is_banned)
        self.assertFalse(user.is_active)
        self.assertEqual(user.ban_reason, "Test ban")
        self.assertEqual(user.banned_by, admin)

    def test_unban_user(self):
        user = User.objects.create_user(**self.user_data)
        admin = User.objects.create_superuser(
            email="admin@example.com",
            username="admin",
            password="AdminPass123!"
        )

        user.ban(reason="Test ban", banned_by=admin)
        user.unban()

        self.assertFalse(user.is_banned)
        self.assertTrue(user.is_active)

    def test_user_uuid_is_unique(self):
        user1 = User.objects.create_user(**self.user_data)
        user2_data = self.user_data.copy()
        user2_data["email"] = "test2@example.com"
        user2_data["username"] = "testuser2"
        user2 = User.objects.create_user(**user2_data)

        self.assertNotEqual(user1.uuid, user2.uuid)
