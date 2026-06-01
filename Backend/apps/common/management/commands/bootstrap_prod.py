import os

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() == "true"


class Command(BaseCommand):
    help = "Bootstraps production runtime tasks with a Postgres advisory lock."

    def handle(self, *args, **options):
        run_migrate = _env_bool("RUN_MIGRATE", True)
        run_seed = _env_bool("RUN_SEED_PROD", True)
        run_collectstatic = _env_bool("RUN_COLLECTSTATIC", True)
        use_lock = _env_bool("BOOTSTRAP_USE_DB_LOCK", True)
        lock_id = int(os.environ.get("BOOTSTRAP_LOCK_ID", "9034212341234"))

        if use_lock and connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_lock(%s);", [lock_id])
            try:
                self._run_tasks(run_migrate, run_seed, run_collectstatic)
            finally:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_unlock(%s);", [lock_id])
        else:
            self._run_tasks(run_migrate, run_seed, run_collectstatic)

    def _run_tasks(self, run_migrate: bool, run_seed: bool, run_collectstatic: bool) -> None:
        if run_migrate:
            call_command("migrate", interactive=False, verbosity=1)
        if run_seed:
            call_command("seed_prod", verbosity=1)
        if run_collectstatic:
            call_command("collectstatic", interactive=False, verbosity=1, clear=False)

