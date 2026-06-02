from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0021_backupjob"),
    ]

    operations = [
        migrations.AddField(
            model_name="backupjob",
            name="stage",
            field=models.CharField(blank=True, db_index=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="backupjob",
            name="cancel_requested",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddIndex(
            model_name="backupjob",
            index=models.Index(fields=["stage", "-created_at"], name="accounts_ba_stage__6c15f2_idx"),
        ),
    ]

