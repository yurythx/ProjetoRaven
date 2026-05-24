"""Common Celery tasks — infrastructure-level (backup, pruning, housekeeping)."""
import logging
import os
import subprocess
from datetime import timedelta
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="apps.common.tasks.backup_postgres", bind=True, max_retries=2, default_retry_delay=300)
def backup_postgres(self):
    """Run pg_dump and write a compressed backup file.

    Backup directory is controlled by BACKUP_DIR (default: /app/backups).
    Files older than BACKUP_RETENTION_DAYS (default: 30) are pruned.
    Skipped silently when USE_SQLITE is True (dev/CI environments).
    """
    if getattr(settings, "USE_SQLITE", False):
        logger.info("backup_postgres: SQLite mode — skipping pg_dump")
        return {"status": "skipped", "reason": "sqlite"}

    backup_dir = Path(os.environ.get("BACKUP_DIR", "/app/backups"))
    backup_dir.mkdir(parents=True, exist_ok=True)

    retention_days = int(os.environ.get("BACKUP_RETENTION_DAYS", "30"))
    db = settings.DATABASES["default"]

    timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    filename = backup_dir / f"raven_{timestamp}.sql.gz"

    env = os.environ.copy()
    env["PGPASSWORD"] = db.get("PASSWORD", "")

    cmd = [
        "pg_dump",
        "-h", db.get("HOST", "localhost"),
        "-p", str(db.get("PORT", "5432")),
        "-U", db.get("USER", "postgres"),
        "-d", db.get("NAME", "projeto_raven"),
        "--no-password",
        "--format=plain",
        "--no-acl",
        "--no-owner",
    ]

    try:
        with open(filename, "wb") as fh:
            dump = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            gzip = subprocess.Popen(["gzip", "-c"], stdin=dump.stdout, stdout=fh, stderr=subprocess.PIPE)
            dump.stdout.close()  # allow dump to receive SIGPIPE if gzip exits
            gzip.wait()
            dump.wait()

        if dump.returncode != 0:
            stderr = dump.stderr.read().decode(errors="replace")
            logger.error("backup_postgres: pg_dump failed (rc=%d): %s", dump.returncode, stderr)
            raise RuntimeError(f"pg_dump exited {dump.returncode}")

        size_mb = filename.stat().st_size / 1_048_576
        logger.info("backup_postgres: wrote %s (%.2f MB)", filename.name, size_mb)

    except Exception as exc:
        if filename.exists():
            filename.unlink(missing_ok=True)
        raise self.retry(exc=exc)

    # Prune old backups
    cutoff = timezone.now() - timedelta(days=retention_days)
    pruned = 0
    for old in backup_dir.glob("raven_*.sql.gz"):
        if old.stat().st_mtime < cutoff.timestamp():
            old.unlink(missing_ok=True)
            pruned += 1

    if pruned:
        logger.info("backup_postgres: pruned %d backup(s) older than %d days", pruned, retention_days)

    return {"status": "ok", "file": filename.name, "size_mb": round(size_mb, 2), "pruned": pruned}
