import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "recipient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "verb",
                    models.CharField(
                        choices=[
                            ("forum_reply", "Nova resposta no seu tópico"),
                            ("blog_comment", "Novo comentário no seu artigo"),
                        ],
                        max_length=50,
                    ),
                ),
                ("actor_name", models.CharField(max_length=150)),
                ("message", models.TextField()),
                ("target_url", models.CharField(blank=True, max_length=500)),
                ("read", models.BooleanField(db_index=True, default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "read"], name="notificatio_recipie_idx"),
        ),
    ]
