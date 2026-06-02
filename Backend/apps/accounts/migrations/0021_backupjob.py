from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0020_remove_hwid_unity_token"),
    ]

    operations = [
        migrations.CreateModel(
            name="BackupJob",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("started_at", models.DateTimeField(null=True, blank=True)),
                ("finished_at", models.DateTimeField(null=True, blank=True)),
                ("kind", models.CharField(max_length=16, db_index=True, choices=[("backup", "Backup"), ("restore", "Restore"), ("prune", "Prune")])),
                ("status", models.CharField(max_length=16, db_index=True, default="pending", choices=[("pending", "Pending"), ("running", "Running"), ("success", "Success"), ("failed", "Failed")])),
                ("backup_id", models.CharField(max_length=64, blank=True, db_index=True)),
                ("include_media", models.BooleanField(default=True)),
                ("wipe_media", models.BooleanField(default=True)),
                ("keep_last", models.PositiveIntegerField(null=True, blank=True)),
                ("log", models.TextField(blank=True, default="")),
                ("error", models.TextField(blank=True, default="")),
                ("result", models.JSONField(default=dict, blank=True)),
                (
                    "requested_by",
                    models.ForeignKey(
                        null=True,
                        blank=True,
                        to="accounts.user",
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="backup_jobs",
                    ),
                ),
            ],
            options={
                "db_table": "accounts_backup_jobs",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="backupjob",
            index=models.Index(fields=["kind", "-created_at"], name="accounts_ba_kind_1f3f4c_idx"),
        ),
        migrations.AddIndex(
            model_name="backupjob",
            index=models.Index(fields=["status", "-created_at"], name="accounts_ba_status_0f3f75_idx"),
        ),
        migrations.AddIndex(
            model_name="backupjob",
            index=models.Index(fields=["backup_id", "-created_at"], name="accounts_ba_backup__8ad2ef_idx"),
        ),
    ]

