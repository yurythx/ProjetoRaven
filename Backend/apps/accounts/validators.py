import re
import uuid
from datetime import date
from typing import Optional

from django.contrib.auth.password_validation import MinimumLengthValidator
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator, MaxValueValidator, MinValueValidator
from django.utils import timezone


class CustomValidators:
    """Collection of custom validators."""

    MIN_PASSWORD_LENGTH = 8
    MAX_DISPLAY_NAME_LENGTH = 100
    MAX_BIO_LENGTH = 500
    MIN_AGE = 13

    @staticmethod
    def validate_email(email: str) -> str:
        validator = EmailValidator()
        try:
            validator(email)
        except ValidationError:
            raise ValidationError("Invalid email address format.")
        return email.lower()

    @staticmethod
    def validate_username(username: str) -> str:
        if len(username) < 3:
            raise ValidationError("Username must be at least 3 characters long.")
        if len(username) > 30:
            raise ValidationError("Username must be at most 30 characters long.")
        if not re.match(r"^[a-zA-Z0-9_-]+$", username):
            raise ValidationError(
                "Username can only contain letters, numbers, underscores and hyphens."
            )
        return username

    @staticmethod
    def validate_password(password: str) -> str:
        if len(password) < CustomValidators.MIN_PASSWORD_LENGTH:
            raise ValidationError(
                f"A senha deve ter pelo menos {CustomValidators.MIN_PASSWORD_LENGTH} caracteres."
            )
        if not re.search(r"[A-Z]", password):
            raise ValidationError("A senha deve conter pelo menos uma letra maiúscula.")
        if not re.search(r"[a-z]", password):
            raise ValidationError("A senha deve conter pelo menos uma letra minúscula.")
        if not re.search(r"\d", password):
            raise ValidationError("A senha deve conter pelo menos um número.")
        if not re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?\\|`~]", password):
            raise ValidationError("A senha deve conter pelo menos um caractere especial (!@#$%^&* etc).")

        common_passwords = [
            "password", "12345678", "qwerty", "abc123", "password123",
            "admin123", "letmein", "welcome", "monkey", "dragon",
            "Senha@123", "Pass@word1",
        ]
        if password.lower() in [p.lower() for p in common_passwords]:
            raise ValidationError("Essa senha é muito comum. Escolha uma senha mais forte.")

        return password

    @staticmethod
    def validate_display_name(display_name: str) -> str:
        if len(display_name) < 2:
            raise ValidationError("Display name must be at least 2 characters long.")
        if len(display_name) > CustomValidators.MAX_DISPLAY_NAME_LENGTH:
            raise ValidationError(
                f"Display name must be at most {CustomValidators.MAX_DISPLAY_NAME_LENGTH} characters long."
            )
        if not re.match(r"^[\w\s'-]+$", display_name):
            raise ValidationError(
                "Display name contains invalid characters."
            )
        return display_name.strip()

    @staticmethod
    def validate_birth_date(birth_date: date) -> date:
        today = date.today()
        age = today.year - birth_date.year - (
            (today.month, today.day) < (birth_date.month, birth_date.day)
        )

        if age < CustomValidators.MIN_AGE:
            raise ValidationError(
                f"You must be at least {CustomValidators.MIN_AGE} years old to register."
            )

        if birth_date >= today:
            raise ValidationError("Birth date cannot be in the future.")

        max_date = date(today.year - 120, today.month, today.day)
        if birth_date < max_date:
            raise ValidationError("Please enter a valid birth date.")

        return birth_date

    @staticmethod
    def validate_ban_reason(reason: str) -> str:
        if not reason or len(reason.strip()) < 10:
            raise ValidationError(
                "Ban reason must be at least 10 characters long."
            )
        if len(reason) > 1000:
            raise ValidationError("Ban reason is too long (max 1000 characters).")
        return reason.strip()

    @staticmethod
    def validate_uuid(value: str) -> uuid.UUID:
        try:
            return uuid.UUID(str(value))
        except (ValueError, AttributeError):
            raise ValidationError("Invalid UUID format.")


class PasswordStrengthValidator:
    """Additional password strength validation."""

    @staticmethod
    def validate(password: str, user_data: dict = None) -> None:
        errors = []

        if len(password) < 8:
            errors.append("Password must be at least 8 characters long.")

        if not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter.")

        if not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter.")

        if not re.search(r"\d", password):
            errors.append("Password must contain at least one digit.")

        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Password must contain at least one special character.")

        if user_data:
            username = user_data.get("username", "")
            email = user_data.get("email", "")

            if username and username.lower() in password.lower():
                errors.append("Password cannot contain your username.")

            if email:
                email_local = email.split("@")[0]
                if email_local.lower() in password.lower():
                    errors.append("Password cannot contain part of your email.")

        if errors:
            raise ValidationError(errors)
