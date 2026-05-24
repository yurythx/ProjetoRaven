from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    """Custom manager for User model."""

    use_in_migrations = True

    def _create_user(self, email: str, username: str, password: str, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        if not username:
            raise ValueError("Username is required")

        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, username: str, password: str = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("is_active", True)
        return self._create_user(email, username, password, **extra_fields)

    def create_superuser(self, email: str, username: str, password: str = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, username, password, **extra_fields)

    def get_by_email(self, email: str):
        return self.filter(email__iexact=email).first()

    def get_active(self):
        return self.filter(is_active=True)

    def get_players(self):
        return self.filter(groups__name="players")

    def get_admins(self):
        return self.filter(is_staff=True)

    def get_blog_editors(self):
        return self.filter(groups__name="blog_editors")

    def get_forum_moderators(self):
        return self.filter(groups__name="forum_moderators")

    def get_banned(self):
        return self.filter(is_banned=True)

    def get_active_not_banned(self):
        return self.filter(is_active=True, is_banned=False)
