"""
Tests for serializers.
"""
from datetime import date

from django.test import TestCase

from apps.accounts.serializers import (
    BanUserSerializer,
    ChangePasswordSerializer,
    UserRegistrationSerializer,
    UserProfileSerializer,
)


class UserRegistrationSerializerTestCase(TestCase):
    """Test cases for UserRegistrationSerializer."""

    def test_valid_registration_data(self):
        data = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "TestPass123!",
            "password_confirm": "TestPass123!",
            "display_name": "Test User",
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_password_mismatch(self):
        data = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "TestPass123!",
            "password_confirm": "DifferentPass123!",
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("password_confirm", serializer.errors)

    def test_weak_password(self):
        data = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "weak",
            "password_confirm": "weak",
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())

    def test_invalid_email(self):
        data = {
            "email": "invalid-email",
            "username": "testuser",
            "password": "TestPass123!",
            "password_confirm": "TestPass123!",
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())


class BanUserSerializerTestCase(TestCase):
    """Test cases for BanUserSerializer."""

    def test_valid_ban_reason(self):
        data = {"reason": "This is a valid ban reason with enough characters."}
        serializer = BanUserSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_short_ban_reason(self):
        data = {"reason": "Short"}
        serializer = BanUserSerializer(data=data)
        self.assertFalse(serializer.is_valid())


class ChangePasswordSerializerTestCase(TestCase):
    """Test cases for ChangePasswordSerializer."""

    def test_valid_password_change(self):
        data = {
            "current_password": "OldPass123!",
            "new_password": "NewPass123!",
            "new_password_confirm": "NewPass123!",
        }
        serializer = ChangePasswordSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_new_password_mismatch(self):
        data = {
            "current_password": "OldPass123!",
            "new_password": "NewPass123!",
            "new_password_confirm": "DifferentPass123!",
        }
        serializer = ChangePasswordSerializer(data=data)
        self.assertFalse(serializer.is_valid())
