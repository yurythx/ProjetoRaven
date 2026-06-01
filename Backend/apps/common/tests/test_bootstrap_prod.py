import os

from django.core.management import call_command
from django.test import TestCase


class BootstrapProdTestCase(TestCase):
    def test_bootstrap_prod_can_noop_via_env_flags(self):
        before = dict(os.environ)
        try:
            os.environ["RUN_MIGRATE"] = "false"
            os.environ["RUN_SEED_PROD"] = "false"
            os.environ["RUN_COLLECTSTATIC"] = "false"
            call_command("bootstrap_prod", verbosity=0)
        finally:
            os.environ.clear()
            os.environ.update(before)

