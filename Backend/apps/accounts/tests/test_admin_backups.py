import gzip
import os
import tarfile
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.models import BackupJob


class _FakeCursor:
    def execute(self, _sql, _params=None):
        return None


class _CursorCM:
    def __enter__(self):
        return _FakeCursor()

    def __exit__(self, _exc_type, _exc, _tb):
        return False


class _FakeConn:
    def cursor(self):
        return _CursorCM()


class _FakeConnections:
    def __getitem__(self, _key):
        return _FakeConn()


def _write_fake_dump(out_gz_path: Path):
    out_gz_path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out_gz_path, "wb") as f:
        f.write(b"-- fake dump --\n")


class AdminBackupsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(email="admin@example.com", username="admin", password="Pass1234!")
        self.client.force_authenticate(user=self.admin)

    def test_create_backup_db_only(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    res = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                    self.assertEqual(res.status_code, 201)
                    payload = res.json()
                    self.assertIn("_", payload["id"])
                    self.assertIsNotNone(payload["db"])
                    self.assertIsNone(payload["media"])

                    db_name = payload["db"]["name"]
                    self.assertTrue((Path(backup_dir) / db_name).exists())
                    self.assertTrue((Path(backup_dir) / f"backup_{payload['id']}.json").exists())

    def test_create_backup_includes_media_tar(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            media_root_p = Path(media_root)
            (media_root_p / "img").mkdir(parents=True, exist_ok=True)
            (media_root_p / "img" / "a.txt").write_text("hello", encoding="utf-8")

            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    res = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": True}, format="json")
                    self.assertEqual(res.status_code, 201)
                    payload = res.json()
                    self.assertIsNotNone(payload["db"])
                    self.assertIsNotNone(payload["media"])

                    media_name = payload["media"]["name"]
                    media_path = Path(backup_dir) / media_name
                    self.assertTrue(media_path.exists())

                    with tarfile.open(media_path, "r:gz") as tar:
                        names = set(tar.getnames())
                    self.assertIn("img/a.txt", names)

    def test_download_db_file(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    created = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                    self.assertEqual(created.status_code, 201)
                    backup_id = created.json()["id"]

                    res = self.client.get(f"/api/v1/accounts/admin/backups/{backup_id}/download/?part=db")
                    self.assertEqual(res.status_code, 200)
                    self.assertIn("attachment", res.get("Content-Disposition", ""))
                    if hasattr(res, "close"):
                        res.close()

    def test_restore_requires_confirmation_and_can_restore_media(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            media_root_p = Path(media_root)
            (media_root_p / "img").mkdir(parents=True, exist_ok=True)
            (media_root_p / "img" / "a.txt").write_text("hello", encoding="utf-8")

            called = {"restore": 0}

            def _fake_restore(_in_gz_path: Path):
                called["restore"] += 1

            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root, DEBUG=True):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups._run_psql_restore", side_effect=_fake_restore), patch(
                    "apps.accounts.api.backups.connections", new=_FakeConnections()
                ):
                    created = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": True}, format="json")
                    self.assertEqual(created.status_code, 201)
                    backup_id = created.json()["id"]

                    (media_root_p / "img" / "a.txt").unlink()
                    (media_root_p / "tmp.txt").write_text("will_be_deleted", encoding="utf-8")

                    bad = self.client.post(
                        f"/api/v1/accounts/admin/backups/{backup_id}/restore/",
                        {"confirm": "nope", "include_media": True, "wipe_media": True},
                        format="json",
                    )
                    self.assertEqual(bad.status_code, 400)

                    ok = self.client.post(
                        f"/api/v1/accounts/admin/backups/{backup_id}/restore/",
                        {"confirm": f"RESTORE {backup_id}", "include_media": True, "wipe_media": True},
                        format="json",
                    )
                    self.assertEqual(ok.status_code, 200)
                    self.assertEqual(called["restore"], 1)
                    self.assertTrue((media_root_p / "img" / "a.txt").exists())
                    self.assertFalse((media_root_p / "tmp.txt").exists())

    def test_restore_is_disabled_when_not_allowed(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root, DEBUG=False):
                with patch.dict(os.environ, {}, clear=True), patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    created = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                    self.assertEqual(created.status_code, 201)
                    backup_id = created.json()["id"]
                    res = self.client.post(
                        f"/api/v1/accounts/admin/backups/{backup_id}/restore/",
                        {"confirm": f"RESTORE {backup_id}", "include_media": False, "wipe_media": False},
                        format="json",
                    )
                    self.assertEqual(res.status_code, 403)

    def test_delete_backup_removes_files_and_manifest(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    created = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                    self.assertEqual(created.status_code, 201)
                    backup_id = created.json()["id"]
                    manifest = Path(backup_dir) / f"backup_{backup_id}.json"
                    self.assertTrue(manifest.exists())

                    res = self.client.delete(f"/api/v1/accounts/admin/backups/{backup_id}/")
                    self.assertEqual(res.status_code, 204)
                    self.assertFalse(manifest.exists())

    def test_prune_keeps_last_n(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    for _ in range(3):
                        res = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                        self.assertEqual(res.status_code, 201)

                    before = self.client.get("/api/v1/accounts/admin/backups/")
                    self.assertEqual(before.status_code, 200)
                    self.assertEqual(len(before.json()["items"]), 3)

                    pruned = self.client.post("/api/v1/accounts/admin/backups/prune/", {"keep_last": 1}, format="json")
                    self.assertEqual(pruned.status_code, 200)
                    after = self.client.get("/api/v1/accounts/admin/backups/")
                    self.assertEqual(after.status_code, 200)
                    self.assertEqual(len(after.json()["items"]), 1)

    def test_verify_detects_corrupted_db_gzip(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    created = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                    self.assertEqual(created.status_code, 201)
                    backup_id = created.json()["id"]

                    manifest = Path(backup_dir) / f"backup_{backup_id}.json"
                    self.assertTrue(manifest.exists())
                    db_file = created.json()["db"]["name"]
                    (Path(backup_dir) / db_file).write_bytes(b"not a gzip")

                    res = self.client.get(f"/api/v1/accounts/admin/backups/{backup_id}/verify/")
                    self.assertEqual(res.status_code, 409)
                    payload = res.json()
                    self.assertEqual(payload["ok"], False)
                    self.assertIsNotNone(payload["db"])

    def test_restore_job_creates_job_and_is_queryable(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root, DEBUG=True, CELERY_BROKER_URL="redis://test/2"):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups._run_psql_restore", side_effect=lambda _p: None), patch(
                    "apps.accounts.api.backups.connections", new=_FakeConnections()
                ), patch("apps.accounts.tasks.run_restore_job.delay") as mocked_delay:
                    created = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                    self.assertEqual(created.status_code, 201)
                    backup_id = created.json()["id"]

                    res = self.client.post(
                        f"/api/v1/accounts/admin/backups/{backup_id}/restore-job/",
                        {"confirm": f"RESTORE {backup_id}", "include_media": False, "wipe_media": False},
                        format="json",
                    )
                    self.assertEqual(res.status_code, 201)
                    payload = res.json()
                    job_id = payload["id"]
                    self.assertTrue(BackupJob.objects.filter(id=job_id).exists())
                    mocked_delay.assert_called()

                    fetched = self.client.get(f"/api/v1/accounts/admin/backup-jobs/{job_id}/")
                    self.assertEqual(fetched.status_code, 200)

    def test_backup_job_creates_job_and_is_queryable(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root, CELERY_BROKER_URL="redis://test/2"):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()), patch(
                    "apps.accounts.tasks.run_backup_job.delay"
                ) as mocked_delay:
                    res = self.client.post("/api/v1/accounts/admin/backups/job/", {"include_media": False}, format="json")
                    self.assertEqual(res.status_code, 201)
                    payload = res.json()
                    job_id = payload["id"]
                    self.assertTrue(BackupJob.objects.filter(id=job_id).exists())
                    mocked_delay.assert_called()

    def test_prune_job_creates_job_and_is_queryable(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root, CELERY_BROKER_URL="redis://test/2"):
                with patch("apps.accounts.tasks.run_prune_job.delay") as mocked_delay:
                    res = self.client.post("/api/v1/accounts/admin/backups/prune-job/", {"keep_last": 5}, format="json")
                    self.assertEqual(res.status_code, 201)
                    payload = res.json()
                    job_id = payload["id"]
                    self.assertTrue(BackupJob.objects.filter(id=job_id).exists())
                    mocked_delay.assert_called()

                    fetched = self.client.get(f"/api/v1/accounts/admin/backup-jobs/{job_id}/")
                    self.assertEqual(fetched.status_code, 200)

    def test_prune_job_task_deletes_old_backups(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    for _ in range(3):
                        res = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                        self.assertEqual(res.status_code, 201)

                job = BackupJob.objects.create(
                    kind=BackupJob.Kind.PRUNE,
                    status=BackupJob.Status.PENDING,
                    requested_by=self.admin,
                    keep_last=1,
                )

                from apps.accounts.tasks import run_prune_job
                run_prune_job(str(job.id))

                job.refresh_from_db()
                self.assertEqual(job.status, BackupJob.Status.SUCCESS)
                after = self.client.get("/api/v1/accounts/admin/backups/")
                self.assertEqual(after.status_code, 200)
                self.assertEqual(len(after.json()["items"]), 1)

    def test_cancel_job_marks_pending_as_cancelled(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root, CELERY_BROKER_URL="redis://test/2"):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()), patch(
                    "apps.accounts.tasks.run_backup_job.delay"
                ):
                    created = self.client.post("/api/v1/accounts/admin/backups/job/", {"include_media": False}, format="json")
                    self.assertEqual(created.status_code, 201)
                    job_id = created.json()["id"]

                    res = self.client.post(f"/api/v1/accounts/admin/backup-jobs/{job_id}/cancel/", {}, format="json")
                    self.assertEqual(res.status_code, 200)
                    payload = res.json()
                    self.assertEqual(payload["status"], "cancelled")
                    self.assertEqual(payload["cancel_requested"], True)

    def test_cancel_requested_prevents_task_from_running(self):
        job = BackupJob.objects.create(
            kind=BackupJob.Kind.BACKUP,
            status=BackupJob.Status.PENDING,
            requested_by=self.admin,
            include_media=False,
            cancel_requested=True,
        )
        with patch("apps.accounts.api.backups.perform_backup") as mocked_perform:
            from apps.accounts.tasks import run_backup_job
            run_backup_job(str(job.id))
            mocked_perform.assert_not_called()

        job.refresh_from_db()
        self.assertEqual(job.status, BackupJob.Status.CANCELLED)

    def test_audit_events_can_filter_by_action_prefix(self):
        with tempfile.TemporaryDirectory() as backup_dir, tempfile.TemporaryDirectory() as media_root:
            with override_settings(BACKUP_DIR=backup_dir, MEDIA_ROOT=media_root):
                with patch("apps.accounts.api.backups._is_postgres", return_value=True), patch(
                    "apps.accounts.api.backups._run_pg_dump", side_effect=_write_fake_dump
                ), patch("apps.accounts.api.backups.connections", new=_FakeConnections()):
                    created = self.client.post("/api/v1/accounts/admin/backups/", {"include_media": False}, format="json")
                    self.assertEqual(created.status_code, 201)

                    res = self.client.get("/api/v1/accounts/audit-events/?page=1&page_size=10&ordering=-created_at&action_prefix=backup_")
                    self.assertEqual(res.status_code, 200)
                    payload = res.json()
                    actions = [ev.get("action") for ev in payload.get("results") or []]
                    self.assertIn("backup_create", actions)
