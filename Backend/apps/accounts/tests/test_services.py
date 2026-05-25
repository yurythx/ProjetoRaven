"""
Tests for modular accounts services.
"""
from datetime import date
from django.contrib.auth.models import Group
from django.test import TestCase

from apps.accounts.models import AdminAuditEvent, User
from apps.accounts.services.auth import AuthService
from apps.accounts.services.profile import ProfileService
from apps.accounts.services.query import UserQueryService
from apps.accounts.services.management import UserManagementService

class UserRegistrationServiceTestCase(TestCase):
    """Test cases for AuthService (Registration)."""

    def setUp(self):
        Group.objects.get_or_create(name="members")
        self.service = AuthService()
        self.user_data = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "TestPass123!",
            "display_name": "Test User",
        }

    def test_register_user_success(self):
        user = self.service.register_user(**self.user_data)

        self.assertIsNotNone(user)
        self.assertEqual(user.email, "test@example.com")
        self.assertEqual(user.username, "testuser")
        self.assertTrue(user.is_member)
        self.assertTrue(AdminAuditEvent.objects.filter(action="register_user", target=user).exists())

    def test_register_user_records_ip_and_user_agent(self):
        user = self.service.register_user(
            **self.user_data,
            registration_ip="203.0.113.11",
            user_agent="pytest-agent",
        )
        ev = AdminAuditEvent.objects.filter(action="register_user", target=user).order_by("-created_at").first()
        self.assertIsNotNone(ev)
        self.assertEqual(ev.ip_address, "203.0.113.11")
        self.assertEqual(ev.user_agent, "pytest-agent")

    def test_register_user_with_birth_date(self):
        data = self.user_data.copy()
        data["birth_date"] = date(2000, 1, 1)
        user = self.service.register_user(**data)

        self.assertEqual(user.birth_date, date(2000, 1, 1))

    def test_register_duplicate_email_raises_error(self):
        self.service.register_user(**self.user_data)

        with self.assertRaises(ValueError) as context:
            self.service.register_user(**self.user_data)

        self.assertIn("Email already registered", str(context.exception))

    def test_register_duplicate_username_raises_error(self):
        self.service.register_user(**self.user_data)

        data = self.user_data.copy()
        data["email"] = "different@example.com"

        with self.assertRaises(ValueError) as context:
            self.service.register_user(**data)

        self.assertIn("Username already taken", str(context.exception))

class UserManagementServiceTestCase(TestCase):
    """Test cases for UserManagementService."""

    def setUp(self):
        Group.objects.get_or_create(name="members")
        Group.objects.get_or_create(name="blog_editors")
        Group.objects.get_or_create(name="forum_moderators")
        Group.objects.get_or_create(name="admins")
        
        self.service = UserManagementService()

        self.admin = User.objects.create_superuser(
            email="admin@example.com",
            username="admin",
            password="AdminPass123!"
        )
        self.staff = User.objects.create_user(
            email="staff@example.com",
            username="staff",
            password="StaffPass123!"
        )
        self.staff.is_staff = True
        self.staff.save(update_fields=["is_staff"])
        
        self.moderator = User.objects.create_user(
            email="mod@example.com",
            username="moderator",
            password="ModPass123!"
        )
        mod_group = Group.objects.get(name="forum_moderators")
        self.moderator.groups.add(mod_group)

        self.user = User.objects.create_user(
            email="user@example.com",
            username="regularuser",
            password="UserPass123!"
        )

    def test_ban_user_by_admin(self):
        banned_user = self.service.ban_user(
            user=self.user,
            reason="Test ban reason",
            banned_by=self.admin
        )

        self.assertTrue(banned_user.is_banned)
        self.assertFalse(banned_user.is_active)

    def test_ban_superuser_raises_error(self):
        with self.assertRaises(ValueError) as context:
            self.service.ban_user(
                user=self.admin,
                reason="Test ban",
                banned_by=self.admin
            )

        self.assertIn("Cannot ban a superuser", str(context.exception))

    def test_unban_user_by_admin(self):
        self.user.ban(reason="Test ban", banned_by=self.admin)
        unbanned_user = self.service.unban_user(
            user=self.user,
            unbanned_by=self.admin
        )

        self.assertFalse(unbanned_user.is_banned)
        self.assertTrue(unbanned_user.is_active)

    def test_update_user_staff_cannot_promote_superuser(self):
        updated = self.service.update_user(
            user=self.user,
            data={"is_superuser": True, "is_staff": True},
            updated_by=self.staff,
        )
        self.assertFalse(updated.is_superuser)
        self.assertTrue(updated.is_staff)

    def test_change_groups_admin_allowed(self):
        updated = self.service.change_user_groups(
            user=self.user,
            group_names=["members", "blog_editors"],
            modified_by=self.admin,
        )
        self.assertEqual(sorted([g.name for g in updated.groups.all()]), ["blog_editors", "members"])

class ProfileServiceTestCase(TestCase):
    """Test cases for ProfileService."""

    def setUp(self):
        self.service = ProfileService()
        self.user = User.objects.create_user(
            email="test@example.com",
            username="testuser",
            password="TestPass123!",
            display_name="Test User"
        )

    def test_get_profile(self):
        profile = self.service.get_profile(self.user)

        self.assertEqual(profile["email"], "test@example.com")
        self.assertEqual(profile["username"], "testuser")
        self.assertEqual(profile["display_name"], "Test User")

    def test_update_own_profile(self):
        updated_user = self.service.update_own_profile(
            user=self.user,
            data={"display_name": "New Name"}
        )

        self.assertEqual(updated_user.display_name, "New Name")

    def test_change_own_password_success(self):
        self.service.change_own_password(
            user=self.user,
            current_password="TestPass123!",
            new_password="NewPass123!"
        )

        self.assertTrue(self.user.check_password("NewPass123!"))

class UserQueryServiceTestCase(TestCase):
    """Test cases for UserQueryService."""

    def setUp(self):
        self.service = UserQueryService()
        self.user1 = User.objects.create_user(
            email="user1@example.com",
            username="user1",
            password="UserPass123!"
        )
        self.user2 = User.objects.create_user(
            email="user2@example.com",
            username="user2",
            password="UserPass123!"
        )

    def test_get_all_users_with_pagination(self):
        users = self.service.get_all_users(page=1, page_size=10)
        self.assertEqual(len(users), 2)

    def test_search_users(self):
        users = self.service.search_users(query="user1")
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0].email, "user1@example.com")


class BanKickIntegrationTestCase(TestCase):
    """Verify that ban/deactivate correctly update user state."""

    def setUp(self):
        self.service = UserManagementService()
        self.admin = User.objects.create_superuser(
            email="admin_kick@example.com",
            username="admin_kick",
            password="AdminPass123!",
        )
        self.target = User.objects.create_user(
            email="target_kick@example.com",
            username="target_kick",
            password="UserPass123!",
        )

    def test_ban_user_schedules_kick(self):
        self.service.ban_user(user=self.target, reason="cheating detected", banned_by=self.admin)

        self.target.refresh_from_db()
        self.assertTrue(self.target.is_banned)
        self.assertFalse(self.target.is_active)

    def test_deactivate_user_schedules_kick(self):
        self.service.deactivate_user(user=self.target, actor=self.admin)

        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)

    def test_ban_kick_redis_failure_does_not_raise(self):
        self.service.ban_user(user=self.target, reason="spamming users repeatedly", banned_by=self.admin)

        self.target.refresh_from_db()
        self.assertTrue(self.target.is_banned)

    def test_deactivate_kick_redis_failure_does_not_raise(self):
        self.service.deactivate_user(user=self.target, actor=self.admin)

        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)
