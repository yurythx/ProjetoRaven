import os

from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import User


class SeedProdTestCase(TestCase):
    def test_seed_prod_admin_username_collision_with_support_user_is_handled(self):
        before = dict(os.environ)
        try:
            os.environ["CREATE_SUPPORT_USER"] = "true"
            os.environ["SUPPORT_USER_USERNAME"] = "suporte"
            os.environ["SUPPORT_USER_EMAIL"] = "support@example.com"
            os.environ["SUPPORT_USER_PASSWORD"] = "Support@1234"

            os.environ["DJANGO_ADMIN_EMAIL"] = "yury@example.com"
            os.environ["DJANGO_ADMIN_USERNAME"] = "suporte"
            os.environ["DJANGO_ADMIN_PASSWORD"] = "Admin@1234"

            call_command("seed_prod", verbosity=0)

            support = User.objects.get(email="support@example.com")
            self.assertEqual(support.username, "suporte")

            admin = User.objects.get(email="yury@example.com")
            self.assertNotEqual(admin.username, "suporte")
            self.assertTrue(admin.is_staff)
            self.assertTrue(admin.is_superuser)
        finally:
            os.environ.clear()
            os.environ.update(before)
