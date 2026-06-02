import gzip
import json
import os
import shutil
import subprocess
import tarfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from django.conf import settings
from django.db import connections
from django.http import FileResponse, Http404
from django.utils import timezone as dj_timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import BackupJob
from apps.accounts.permissions.account_permissions import IsSuperUser
from apps.accounts.serializers.utils import extract_request_ip_user_agent
from apps.accounts.services.audit import AdminAuditService


@dataclass(frozen=True)
class BackupEntry:
    id: str
    created_at: str
    db_file: str | None
    media_file: str | None

    def to_dict(self, backup_dir: Path) -> dict[str, Any]:
        def _file_meta(name: str | None) -> dict[str, Any] | None:
            if not name:
                return None
            p = (backup_dir / name).resolve()
            if not p.exists():
                return None
            return {"name": name, "size_bytes": int(p.stat().st_size)}

        return {
            "id": self.id,
            "created_at": self.created_at,
            "db": _file_meta(self.db_file),
            "media": _file_meta(self.media_file),
        }


def _env_bool(name: str, default: bool) -> bool:
    val = os.environ.get(name, "")
    if not val:
        return default
    return val.strip().lower() in ["1", "true", "yes", "y", "on"]


def _backup_dir() -> Path:
    p = Path(getattr(settings, "BACKUP_DIR", Path(settings.BASE_DIR) / "backups"))
    p.mkdir(parents=True, exist_ok=True)
    return p


def _advisory_lock_id() -> int:
    raw = os.environ.get("ADMIN_BACKUP_LOCK_ID", "").strip()
    if raw.isdigit():
        return int(raw)
    return 9034212341235


def _is_postgres() -> bool:
    db = settings.DATABASES.get("default", {})
    engine = (db.get("ENGINE") or "").lower()
    return "postgresql" in engine


def _db_conn_params() -> dict[str, str]:
    db = settings.DATABASES.get("default", {})
    return {
        "host": str(db.get("HOST") or ""),
        "port": str(db.get("PORT") or ""),
        "name": str(db.get("NAME") or ""),
        "user": str(db.get("USER") or ""),
        "password": str(db.get("PASSWORD") or ""),
    }


def _safe_extract_tar(tar: tarfile.TarFile, dest_dir: Path) -> None:
    dest_dir = dest_dir.resolve()
    for member in tar.getmembers():
        if member.issym() or member.islnk():
            raise ValueError("Tar inválido")
        if member.isdev():
            raise ValueError("Tar inválido")
        if not member.name:
            raise ValueError("Tar inválido")
        member_path = (dest_dir / member.name).resolve()
        try:
            member_path.relative_to(dest_dir)
        except ValueError as e:
            raise ValueError("Tar inválido") from e
    for member in tar.getmembers():
        tar.extract(member, dest_dir)


def _run_pg_dump(out_gz_path: Path) -> None:
    params = _db_conn_params()
    env = os.environ.copy()
    if params["password"]:
        env["PGPASSWORD"] = params["password"]

    cmd = [
        "pg_dump",
        "--format=plain",
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
    ]
    if params["host"]:
        cmd.extend(["--host", params["host"]])
    if params["port"]:
        cmd.extend(["--port", params["port"]])
    if params["user"]:
        cmd.extend(["--username", params["user"]])
    cmd.append(params["name"])

    with gzip.open(out_gz_path, "wb") as f:
        subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, env=env, check=True)


def _run_psql_restore(in_gz_path: Path) -> None:
    params = _db_conn_params()
    env = os.environ.copy()
    if params["password"]:
        env["PGPASSWORD"] = params["password"]

    cmd = ["psql", "-v", "ON_ERROR_STOP=1", "--single-transaction"]
    if params["host"]:
        cmd.extend(["--host", params["host"]])
    if params["port"]:
        cmd.extend(["--port", params["port"]])
    if params["user"]:
        cmd.extend(["--username", params["user"]])
    cmd.append(params["name"])

    with gzip.open(in_gz_path, "rb") as f:
        subprocess.run(cmd, stdin=f, stderr=subprocess.PIPE, env=env, check=True)


def _write_manifest(entry: BackupEntry, backup_dir: Path) -> None:
    manifest_path = backup_dir / f"backup_{entry.id}.json"
    tmp = backup_dir / f".backup_{entry.id}.json.tmp"
    data = entry.to_dict(backup_dir)
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(manifest_path)


def _read_manifest(backup_id: str, backup_dir: Path) -> BackupEntry | None:
    p = backup_dir / f"backup_{backup_id}.json"
    if not p.exists():
        return None
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return BackupEntry(
            id=str(raw.get("id") or backup_id),
            created_at=str(raw.get("created_at") or ""),
            db_file=(raw.get("db") or {}).get("name") if isinstance(raw.get("db"), dict) else None,
            media_file=(raw.get("media") or {}).get("name") if isinstance(raw.get("media"), dict) else None,
        )
    except Exception:
        return None


def _list_backups(backup_dir: Path) -> list[BackupEntry]:
    entries: list[BackupEntry] = []
    for m in sorted(backup_dir.glob("backup_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        backup_id = m.stem.replace("backup_", "", 1)
        entry = _read_manifest(backup_id, backup_dir)
        if entry:
            entries.append(entry)
    return entries


def _delete_backup(entry: BackupEntry, backup_dir: Path) -> bool:
    deleted_any = False
    for name in [entry.db_file, entry.media_file]:
        if not name:
            continue
        p = (backup_dir / name).resolve()
        try:
            if p.exists():
                p.unlink()
                deleted_any = True
        except Exception:
            pass

    manifest = (backup_dir / f"backup_{entry.id}.json").resolve()
    try:
        if manifest.exists():
            manifest.unlink()
            deleted_any = True
    except Exception:
        pass
    return deleted_any


def _validate_backup_part_path(backup_dir: Path, filename: str) -> Path:
    p = (backup_dir / filename).resolve()
    try:
        p.relative_to(backup_dir.resolve())
    except ValueError as e:
        raise ValueError("Arquivo inválido") from e
    return p


def _verify_gzip_nonempty(path: Path) -> tuple[bool, str]:
    try:
        with gzip.open(path, "rb") as f:
            chunk = f.read(128)
        if not chunk:
            return False, "Arquivo vazio"
        return True, ""
    except Exception as e:
        return False, str(e)


def _verify_tar_gz(path: Path) -> tuple[bool, str, int]:
    try:
        with tarfile.open(path, "r:gz") as tar:
            members = tar.getmembers()
            for m in members:
                name = m.name or ""
                if name.startswith("/") or name.startswith("\\"):
                    return False, "Entrada tar inválida", 0
                if ".." in Path(name).parts:
                    return False, "Entrada tar inválida", 0
            return True, "", len(members)
    except Exception as e:
        return False, str(e), 0


def _restore_backup_from_files(
    *,
    backup_id: str,
    db_path: Path,
    include_media: bool,
    wipe_media: bool,
    media_path: Path | None,
    progress: Callable[[str], None] | None = None,
) -> None:
    if progress:
        progress("restore_db")
    _run_psql_restore(db_path)

    if include_media and media_path:
        if progress:
            progress("restore_media")
        media_root = Path(settings.MEDIA_ROOT).resolve()
        media_root.mkdir(parents=True, exist_ok=True)
        tmp_root = media_root.parent / f".media_restore_{backup_id}"
        if tmp_root.exists():
            shutil.rmtree(tmp_root, ignore_errors=True)
        tmp_root.mkdir(parents=True, exist_ok=True)

        try:
            with tarfile.open(media_path, "r:gz") as tar:
                _safe_extract_tar(tar, tmp_root)

            if wipe_media:
                for child in media_root.iterdir():
                    try:
                        if child.is_dir():
                            shutil.rmtree(child, ignore_errors=True)
                        else:
                            child.unlink()
                    except Exception:
                        pass

            for src in tmp_root.rglob("*"):
                if not src.is_file():
                    continue
                rel = src.relative_to(tmp_root)
                dest = media_root / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                if dest.exists():
                    try:
                        dest.unlink()
                    except Exception:
                        pass
                shutil.copy2(src, dest)
        finally:
            shutil.rmtree(tmp_root, ignore_errors=True)
    if progress:
        progress("done")


def restore_backup_by_id(
    *,
    backup_id: str,
    include_media: bool,
    wipe_media: bool,
    progress: Callable[[str], None] | None = None,
) -> None:
    if not _is_postgres():
        raise ValueError("Restore disponível apenas com Postgres")

    backup_dir = _backup_dir()
    entry = _read_manifest(backup_id, backup_dir)
    if not entry:
        raise Http404()

    db_path = (backup_dir / (entry.db_file or "")).resolve()
    if not db_path.exists():
        raise Http404()

    media_path = (backup_dir / (entry.media_file or "")).resolve() if entry.media_file else None
    if include_media and entry.media_file and (not media_path or not media_path.exists()):
        raise Http404()

    _restore_backup_from_files(
        backup_id=backup_id,
        db_path=db_path,
        include_media=include_media,
        wipe_media=wipe_media,
        media_path=media_path,
        progress=progress,
    )


def _job_to_dict(job: BackupJob) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "kind": job.kind,
        "status": job.status,
        "backup_id": job.backup_id,
        "include_media": bool(job.include_media),
        "wipe_media": bool(job.wipe_media),
        "keep_last": job.keep_last,
        "stage": getattr(job, "stage", "") or "",
        "cancel_requested": bool(getattr(job, "cancel_requested", False)),
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "error": job.error or "",
        "log": job.log or "",
        "result": job.result or {},
    }


def perform_backup(*, include_media: bool, progress: Callable[[str], None] | None = None) -> BackupEntry:
    if not _is_postgres():
        raise ValueError("Backup disponível apenas com Postgres")

    lock_id = _advisory_lock_id()
    with connections["default"].cursor() as cursor:
        if progress:
            progress("lock")
        cursor.execute("SELECT pg_advisory_lock(%s);", [lock_id])

    try:
        if progress:
            progress("prepare_files")
        entry, db_path, media_path = _create_backup_files(include_media=include_media)
        if progress:
            progress("dump_db")
        _run_pg_dump(db_path)

        if media_path:
            if progress:
                progress("tar_media")
            media_root = Path(settings.MEDIA_ROOT).resolve()
            with tarfile.open(media_path, "w:gz") as tar:
                if media_root.exists():
                    for p in media_root.rglob("*"):
                        if p.is_file():
                            tar.add(p, arcname=p.relative_to(media_root))

        backup_dir = _backup_dir()
        if progress:
            progress("write_manifest")
        _write_manifest(entry, backup_dir)
        if progress:
            progress("done")
        return entry
    finally:
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s);", [lock_id])
        except Exception:
            pass


class AdminBackupsView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        backup_dir = _backup_dir()
        entries = _list_backups(backup_dir)
        return Response({"items": [e.to_dict(backup_dir) for e in entries]}, status=status.HTTP_200_OK)

    def post(self, request):
        if not _is_postgres():
            return Response({"error": "Backup disponível apenas com Postgres"}, status=status.HTTP_400_BAD_REQUEST)

        include_media = bool((request.data or {}).get("include_media", True))
        try:
            entry = perform_backup(include_media=include_media)
            backup_dir = _backup_dir()
            ip_address, user_agent = extract_request_ip_user_agent(request)
            AdminAuditService.record(
                action="backup_create",
                actor=request.user,
                target=request.user,
                metadata={"backup_id": entry.id, "include_media": include_media},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            return Response(entry.to_dict(backup_dir), status=status.HTTP_201_CREATED)
        except subprocess.CalledProcessError as e:
            detail = (e.stderr or b"").decode("utf-8", errors="ignore").strip()
            return Response({"error": "Falha ao executar comando do Postgres", "detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminBackupCreateJobView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        if not _is_postgres():
            return Response({"error": "Backup disponível apenas com Postgres"}, status=status.HTTP_400_BAD_REQUEST)

        if not getattr(settings, "CELERY_BROKER_URL", ""):
            return Response({"error": "Fila de jobs não configurada (CELERY_BROKER_URL)"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        include_media = bool((request.data or {}).get("include_media", True))

        job = BackupJob.objects.create(
            kind=BackupJob.Kind.BACKUP,
            status=BackupJob.Status.PENDING,
            requested_by=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
            include_media=include_media,
        )

        from apps.accounts.tasks import run_backup_job

        try:
            run_backup_job.delay(str(job.id))
            ip_address, user_agent = extract_request_ip_user_agent(request)
            AdminAuditService.record(
                action="backup_backup_job",
                actor=request.user,
                target=request.user,
                metadata={"job_id": str(job.id), "include_media": include_media},
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception as e:
            job.status = BackupJob.Status.FAILED
            job.started_at = dj_timezone.now()
            job.finished_at = dj_timezone.now()
            job.error = str(e)
            job.save(update_fields=["status", "started_at", "finished_at", "error", "updated_at"])
            return Response({"error": "Falha ao enfileirar job", "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(_job_to_dict(job), status=status.HTTP_201_CREATED)


class AdminBackupDownloadView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request, backup_id: str):
        backup_dir = _backup_dir()
        entry = _read_manifest(backup_id, backup_dir)
        if not entry:
            raise Http404()

        part = (request.query_params.get("part") or "db").strip().lower()
        if part not in ["db", "media"]:
            return Response({"error": "part inválido"}, status=status.HTTP_400_BAD_REQUEST)

        filename = entry.db_file if part == "db" else entry.media_file
        if not filename:
            raise Http404()

        p = (backup_dir / filename).resolve()
        if not p.exists():
            raise Http404()

        resp = FileResponse(open(p, "rb"), as_attachment=True, filename=filename)
        resp["Content-Type"] = "application/octet-stream"
        resp["Cache-Control"] = "no-store"
        return resp


class AdminBackupRestoreView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request, backup_id: str):
        allow_restore = bool(settings.DEBUG) or _env_bool("ADMIN_BACKUP_ALLOW_RESTORE", False)
        if not allow_restore:
            return Response({"error": "Restore desabilitado neste ambiente"}, status=status.HTTP_403_FORBIDDEN)

        if not _is_postgres():
            return Response({"error": "Restore disponível apenas com Postgres"}, status=status.HTTP_400_BAD_REQUEST)

        backup_dir = _backup_dir()
        entry = _read_manifest(backup_id, backup_dir)
        if not entry:
            raise Http404()

        payload = request.data or {}
        confirm = str(payload.get("confirm") or "").strip()
        required = f"RESTORE {backup_id}"
        if confirm != required:
            return Response({"error": "Confirmação inválida", "required": required}, status=status.HTTP_400_BAD_REQUEST)

        include_media = bool(payload.get("include_media", True))
        wipe_media = bool(payload.get("wipe_media", True))

        lock_id = _advisory_lock_id()
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_advisory_lock(%s);", [lock_id])

            restore_backup_by_id(backup_id=backup_id, include_media=include_media, wipe_media=wipe_media)
            ip_address, user_agent = extract_request_ip_user_agent(request)
            AdminAuditService.record(
                action="backup_restore",
                actor=request.user,
                target=request.user,
                metadata={"backup_id": backup_id, "include_media": include_media, "wipe_media": wipe_media, "mode": "sync"},
                ip_address=ip_address,
                user_agent=user_agent,
            )

            return Response({"status": "ok"}, status=status.HTTP_200_OK)
        except subprocess.CalledProcessError as e:
            detail = (e.stderr or b"").decode("utf-8", errors="ignore").strip()
            return Response({"error": "Falha ao executar comando do Postgres", "detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except ValueError:
            return Response({"error": "Backup de mídia inválido"}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            try:
                with connections["default"].cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_unlock(%s);", [lock_id])
            except Exception:
                pass


class AdminBackupDeleteView(APIView):
    permission_classes = [IsSuperUser]

    def delete(self, request, backup_id: str):
        backup_dir = _backup_dir()
        entry = _read_manifest(backup_id, backup_dir)
        if not entry:
            raise Http404()

        lock_id = _advisory_lock_id()
        try:
            if _is_postgres():
                with connections["default"].cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_lock(%s);", [lock_id])
            _delete_backup(entry, backup_dir)
            ip_address, user_agent = extract_request_ip_user_agent(request)
            AdminAuditService.record(
                action="backup_delete",
                actor=request.user,
                target=request.user,
                metadata={"backup_id": backup_id},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        finally:
            try:
                if _is_postgres():
                    with connections["default"].cursor() as cursor:
                        cursor.execute("SELECT pg_advisory_unlock(%s);", [lock_id])
            except Exception:
                pass


class AdminBackupsPruneView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        backup_dir = _backup_dir()
        payload = request.data or {}
        keep_last_raw = payload.get("keep_last", 20)
        try:
            keep_last = int(keep_last_raw)
        except Exception:
            keep_last = 20
        keep_last = max(1, min(keep_last, 200))

        entries = _list_backups(backup_dir)
        to_delete = entries[keep_last:]

        lock_id = _advisory_lock_id()
        deleted_ids: list[str] = []
        try:
            if _is_postgres():
                with connections["default"].cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_lock(%s);", [lock_id])
            for e in to_delete:
                _delete_backup(e, backup_dir)
                deleted_ids.append(e.id)
        finally:
            try:
                if _is_postgres():
                    with connections["default"].cursor() as cursor:
                        cursor.execute("SELECT pg_advisory_unlock(%s);", [lock_id])
            except Exception:
                pass

        ip_address, user_agent = extract_request_ip_user_agent(request)
        AdminAuditService.record(
            action="backup_prune",
            actor=request.user,
            target=request.user,
            metadata={"deleted": deleted_ids, "kept": keep_last},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return Response({"deleted": deleted_ids, "kept": keep_last}, status=status.HTTP_200_OK)


class AdminBackupsPruneJobView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        if not getattr(settings, "CELERY_BROKER_URL", ""):
            return Response({"error": "Fila de jobs não configurada (CELERY_BROKER_URL)"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        payload = request.data or {}
        keep_last_raw = payload.get("keep_last", 20)
        try:
            keep_last = int(keep_last_raw)
        except Exception:
            keep_last = 20
        keep_last = max(1, min(keep_last, 200))

        job = BackupJob.objects.create(
            kind=BackupJob.Kind.PRUNE,
            status=BackupJob.Status.PENDING,
            requested_by=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
            keep_last=keep_last,
        )

        from apps.accounts.tasks import run_prune_job

        try:
            run_prune_job.delay(str(job.id))
            ip_address, user_agent = extract_request_ip_user_agent(request)
            AdminAuditService.record(
                action="backup_prune_job",
                actor=request.user,
                target=request.user,
                metadata={"job_id": str(job.id), "keep_last": keep_last},
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception as e:
            job.status = BackupJob.Status.FAILED
            job.started_at = dj_timezone.now()
            job.finished_at = dj_timezone.now()
            job.error = str(e)
            job.stage = "failed"
            job.save(update_fields=["status", "started_at", "finished_at", "error", "stage", "updated_at"])
            return Response({"error": "Falha ao enfileirar job", "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(_job_to_dict(job), status=status.HTTP_201_CREATED)


class AdminBackupRestoreJobCreateView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request, backup_id: str):
        allow_restore = bool(settings.DEBUG) or _env_bool("ADMIN_BACKUP_ALLOW_RESTORE", False)
        if not allow_restore:
            return Response({"error": "Restore desabilitado neste ambiente"}, status=status.HTTP_403_FORBIDDEN)

        if not _is_postgres():
            return Response({"error": "Restore disponível apenas com Postgres"}, status=status.HTTP_400_BAD_REQUEST)

        if not getattr(settings, "CELERY_BROKER_URL", ""):
            return Response({"error": "Fila de jobs não configurada (CELERY_BROKER_URL)"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        payload = request.data or {}
        confirm = str(payload.get("confirm") or "").strip()
        required = f"RESTORE {backup_id}"
        if confirm != required:
            return Response({"error": "Confirmação inválida", "required": required}, status=status.HTTP_400_BAD_REQUEST)

        include_media = bool(payload.get("include_media", True))
        wipe_media = bool(payload.get("wipe_media", True))

        job = BackupJob.objects.create(
            kind=BackupJob.Kind.RESTORE,
            status=BackupJob.Status.PENDING,
            requested_by=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
            backup_id=backup_id,
            include_media=include_media,
            wipe_media=wipe_media,
        )

        from apps.accounts.tasks import run_restore_job

        try:
            run_restore_job.delay(str(job.id))
            ip_address, user_agent = extract_request_ip_user_agent(request)
            AdminAuditService.record(
                action="backup_restore_job",
                actor=request.user,
                target=request.user,
                metadata={
                    "job_id": str(job.id),
                    "backup_id": backup_id,
                    "include_media": include_media,
                    "wipe_media": wipe_media,
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception as e:
            job.status = BackupJob.Status.FAILED
            job.started_at = dj_timezone.now()
            job.finished_at = dj_timezone.now()
            job.error = str(e)
            job.save(update_fields=["status", "started_at", "finished_at", "error", "updated_at"])
            return Response({"error": "Falha ao enfileirar job", "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(_job_to_dict(job), status=status.HTTP_201_CREATED)


class AdminBackupJobView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request, job_id: str):
        job = BackupJob.objects.filter(id=job_id).first()
        if not job:
            raise Http404()
        return Response(_job_to_dict(job), status=status.HTTP_200_OK)


class AdminBackupJobCancelView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request, job_id: str):
        job = BackupJob.objects.filter(id=job_id).first()
        if not job:
            raise Http404()

        if job.status in [BackupJob.Status.SUCCESS, BackupJob.Status.FAILED, BackupJob.Status.CANCELLED]:
            return Response(_job_to_dict(job), status=status.HTTP_200_OK)

        job.cancel_requested = True
        if job.status == BackupJob.Status.PENDING:
            job.status = BackupJob.Status.CANCELLED
            job.finished_at = dj_timezone.now()
            job.stage = "cancelled"
            job.save(update_fields=["cancel_requested", "status", "finished_at", "stage", "updated_at"])
        else:
            job.save(update_fields=["cancel_requested", "updated_at"])

        ip_address, user_agent = extract_request_ip_user_agent(request)
        AdminAuditService.record(
            action="backup_job_cancel",
            actor=request.user,
            target=request.user,
            metadata={"job_id": str(job.id), "kind": job.kind, "backup_id": job.backup_id},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return Response(_job_to_dict(job), status=status.HTTP_200_OK)


class AdminBackupVerifyView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request, backup_id: str):
        backup_dir = _backup_dir()
        entry = _read_manifest(backup_id, backup_dir)
        if not entry:
            raise Http404()

        result: dict[str, Any] = {
            "id": entry.id,
            "created_at": entry.created_at,
            "ok": True,
            "db": None,
            "media": None,
        }

        if entry.db_file:
            try:
                db_path = _validate_backup_part_path(backup_dir, entry.db_file)
                exists = db_path.exists()
                size = int(db_path.stat().st_size) if exists else 0
                gzip_ok, gzip_err = _verify_gzip_nonempty(db_path) if exists else (False, "Arquivo não encontrado")
                ok = exists and gzip_ok
                if not ok:
                    result["ok"] = False
                result["db"] = {"name": entry.db_file, "exists": exists, "size_bytes": size, "ok": ok, "error": gzip_err or ""}
            except ValueError as e:
                result["ok"] = False
                result["db"] = {"name": entry.db_file, "exists": False, "size_bytes": 0, "ok": False, "error": str(e)}

        if entry.media_file:
            try:
                media_path = _validate_backup_part_path(backup_dir, entry.media_file)
                exists = media_path.exists()
                size = int(media_path.stat().st_size) if exists else 0
                tar_ok, tar_err, entries = _verify_tar_gz(media_path) if exists else (False, "Arquivo não encontrado", 0)
                ok = exists and tar_ok
                if not ok:
                    result["ok"] = False
                result["media"] = {
                    "name": entry.media_file,
                    "exists": exists,
                    "size_bytes": size,
                    "ok": ok,
                    "entries": int(entries),
                    "error": tar_err or "",
                }
            except ValueError as e:
                result["ok"] = False
                result["media"] = {"name": entry.media_file, "exists": False, "size_bytes": 0, "ok": False, "entries": 0, "error": str(e)}

        return Response(result, status=status.HTTP_200_OK if result["ok"] else status.HTTP_409_CONFLICT)


def _create_backup_files(*, include_media: bool) -> tuple[BackupEntry, Path, Path | None]:
    now = datetime.now(tz=timezone.utc)
    created_at = now.isoformat()

    backup_dir = _backup_dir()
    base_id = now.strftime("%Y%m%d_%H%M%S")
    backup_id = base_id
    suffix = 1
    while (backup_dir / f"backup_{backup_id}.json").exists() or (backup_dir / f"db_{backup_id}.sql.gz").exists():
        suffix += 1
        backup_id = f"{base_id}_{suffix}"

    db_name = f"db_{backup_id}.sql.gz"
    media_name = f"media_{backup_id}.tar.gz" if include_media else None

    db_path = (backup_dir / db_name).resolve()
    media_path = (backup_dir / media_name).resolve() if media_name else None

    entry = BackupEntry(id=backup_id, created_at=created_at, db_file=db_name, media_file=media_name)
    return entry, db_path, media_path
