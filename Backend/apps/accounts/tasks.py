from __future__ import annotations

import traceback

from celery import shared_task
from django.core.cache import caches
from django.utils import timezone

from apps.accounts.models import BackupJob


def _append(job: BackupJob, line: str) -> None:
    job.log = (job.log or "") + line.rstrip() + "\n"
    job.save(update_fields=["log", "updated_at"])


class _Cancelled(Exception):
    pass


def _set_stage(job: BackupJob, stage: str) -> None:
    job.stage = stage
    job.save(update_fields=["stage", "updated_at"])
    _append(job, f"[{timezone.now().isoformat()}] Stage: {stage}")


def _cancel_if_requested(job: BackupJob) -> None:
    if BackupJob.objects.filter(id=job.id, cancel_requested=True).exists():
        raise _Cancelled()



@shared_task(bind=True)
def run_restore_job(self, job_id: str) -> None:
    job = BackupJob.objects.filter(id=job_id).first()
    if not job:
        return
    if getattr(job, "cancel_requested", False):
        job.status = BackupJob.Status.CANCELLED
        job.finished_at = timezone.now()
        job.stage = "cancelled"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
        return


    job.status = BackupJob.Status.RUNNING
    job.started_at = timezone.now()
    job.stage = "starting"
    job.save(update_fields=["status", "started_at", "error", "stage", "updated_at"])
    job.save(update_fields=["status", "started_at", "error", "updated_at"])

    try:
        try:
            caches["default"].set("maintenance:mode", {"message": "Restore em andamento"}, timeout=60 * 60)
        except Exception:
            pass

        _append(job, f"[{timezone.now().isoformat()}] Iniciando restore do backup '{job.backup_id}'")

        from apps.accounts.api.backups import restore_backup_by_id
        last_stage = {"v": ""}
        def _progress(stage: str) -> None:
            _cancel_if_requested(job)
            if stage != last_stage["v"]:
                _set_stage(job, stage)
                last_stage["v"] = stage

        restore_backup_by_id(
            backup_id=job.backup_id,
            include_media=bool(job.include_media),
            wipe_media=bool(job.wipe_media),
            progress=_progress,
        )
        restore_backup_by_id(backup_id=job.backup_id, include_media=bool(job.include_media), wipe_media=bool(job.wipe_media))

        _append(job, f"[{timezone.now().isoformat()}] Restore concluído")
        job.status = BackupJob.Status.SUCCESS
        job.stage = "done"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
    except _Cancelled:
        _append(job, f"[{timezone.now().isoformat()}] Cancelado")
        job.status = BackupJob.Status.CANCELLED
        job.finished_at = timezone.now()
        job.stage = "cancelled"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
        job.save(update_fields=["status", "finished_at", "updated_at"])
    except Exception as e:
        _append(job, f"[{timezone.now().isoformat()}] Falha: {e}")
        _append(job, traceback.format_exc())
        job.status = BackupJob.Status.FAILED
        job.finished_at = timezone.now()
        job.stage = "failed"
        job.save(update_fields=["status", "finished_at", "error", "stage", "updated_at"])
        job.save(update_fields=["status", "finished_at", "error", "updated_at"])
    finally:
        try:
            caches["default"].delete("maintenance:mode")
        except Exception:
            pass


@shared_task(bind=True)
def run_backup_job(self, job_id: str) -> None:
    job = BackupJob.objects.filter(id=job_id).first()
    if not job:
        return
    if getattr(job, "cancel_requested", False):
        job.status = BackupJob.Status.CANCELLED
        job.finished_at = timezone.now()
        job.stage = "cancelled"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
        return


    job.status = BackupJob.Status.RUNNING
    job.started_at = timezone.now()
    job.stage = "starting"
    job.save(update_fields=["status", "started_at", "error", "stage", "updated_at"])
    job.save(update_fields=["status", "started_at", "error", "updated_at"])

    try:
        _append(job, f"[{timezone.now().isoformat()}] Iniciando backup (include_media={bool(job.include_media)})")

        from apps.accounts.api.backups import perform_backup
        last_stage = {"v": ""}
        def _progress(stage: str) -> None:
            _cancel_if_requested(job)
            if stage != last_stage["v"]:
                _set_stage(job, stage)
                last_stage["v"] = stage

        entry = perform_backup(include_media=bool(job.include_media), progress=_progress)
        entry = perform_backup(include_media=bool(job.include_media))
        job.backup_id = entry.id
        job.result = {"backup_id": entry.id}
        job.save(update_fields=["backup_id", "result", "updated_at"])

        _append(job, f"[{timezone.now().isoformat()}] Backup concluído: {entry.id}")
        job.status = BackupJob.Status.SUCCESS
        job.stage = "done"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
    except _Cancelled:
        _append(job, f"[{timezone.now().isoformat()}] Cancelado")
        job.status = BackupJob.Status.CANCELLED
        job.finished_at = timezone.now()
        job.stage = "cancelled"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
        job.save(update_fields=["status", "finished_at", "updated_at"])
    except Exception as e:
        _append(job, f"[{timezone.now().isoformat()}] Falha: {e}")
        _append(job, traceback.format_exc())
        job.status = BackupJob.Status.FAILED
        job.finished_at = timezone.now()
        job.stage = "failed"
        job.save(update_fields=["status", "finished_at", "error", "stage", "updated_at"])
        job.save(update_fields=["status", "finished_at", "error", "stage", "updated_at"])


@shared_task(bind=True)
def run_prune_job(self, job_id: str) -> None:
    job = BackupJob.objects.filter(id=job_id).first()
    if not job:
        return

    if getattr(job, "cancel_requested", False):
        job.status = BackupJob.Status.CANCELLED
        job.finished_at = timezone.now()
        job.stage = "cancelled"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
        return

    job.status = BackupJob.Status.RUNNING
    job.started_at = timezone.now()
    job.error = ""
    job.stage = "starting"
    job.save(update_fields=["status", "started_at", "error", "stage", "updated_at"])

    try:
        keep_last = int(job.keep_last or 20)
        keep_last = max(1, min(keep_last, 200))

        _append(job, f"[{timezone.now().isoformat()}] Iniciando prune (keep_last={keep_last})")
        _set_stage(job, "lock")
        _cancel_if_requested(job)

        from apps.accounts.api.backups import _advisory_lock_id, _backup_dir, _delete_backup, _is_postgres, _list_backups
        from django.db import connections

        backup_dir = _backup_dir()
        entries = _list_backups(backup_dir)
        to_delete = entries[keep_last:]

        lock_id = _advisory_lock_id()
        deleted_ids: list[str] = []

        try:
            if _is_postgres():
                with connections["default"].cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_lock(%s);", [lock_id])

            _set_stage(job, "delete")
            for e in to_delete:
                _cancel_if_requested(job)
                _delete_backup(e, backup_dir)
                deleted_ids.append(e.id)
                _append(job, f"[{timezone.now().isoformat()}] Removido: {e.id}")
        finally:
            try:
                if _is_postgres():
                    with connections["default"].cursor() as cursor:
                        cursor.execute("SELECT pg_advisory_unlock(%s);", [lock_id])
            except Exception:
                pass

        job.result = {"deleted": deleted_ids, "kept": keep_last}
        _set_stage(job, "done")
        job.status = BackupJob.Status.SUCCESS
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "finished_at", "result", "updated_at"])
    except _Cancelled:
        _append(job, f"[{timezone.now().isoformat()}] Cancelado")
        job.status = BackupJob.Status.CANCELLED
        job.finished_at = timezone.now()
        job.stage = "cancelled"
        job.save(update_fields=["status", "finished_at", "stage", "updated_at"])
    except Exception as e:
        _append(job, f"[{timezone.now().isoformat()}] Falha: {e}")
        _append(job, traceback.format_exc())
        job.status = BackupJob.Status.FAILED
        job.finished_at = timezone.now()
        job.error = str(e)
        job.stage = "failed"
        job.save(update_fields=["status", "finished_at", "error", "stage", "updated_at"])
