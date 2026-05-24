import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_fix_index_names"),
    ]

    operations = [
        migrations.CreateModel(
            name="OAuthProviderSettings",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("provider", models.CharField(choices=[("google", "Google"), ("discord", "Discord")], db_index=True, max_length=32, unique=True)),
                ("is_enabled", models.BooleanField(default=False)),
                ("client_id", models.CharField(blank=True, max_length=512)),
                ("client_secret_encrypted", models.TextField(blank=True)),
            ],
            options={
                "db_table": "accounts_oauth_provider_settings",
            },
        ),
    ]
