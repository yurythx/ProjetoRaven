import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_user_is_admin_verified_etc'),
    ]

    operations = [
        migrations.CreateModel(
            name='Friendship',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('blocked', 'Blocked')],
                    default='pending',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('from_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='friendships_sent',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('to_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='friendships_received',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'friendships',
            },
        ),
        migrations.AddConstraint(
            model_name='friendship',
            constraint=models.UniqueConstraint(fields=['from_user', 'to_user'], name='unique_friendship'),
        ),
        migrations.AddIndex(
            model_name='friendship',
            index=models.Index(fields=['from_user', 'status'], name='friendships_from_user_status_idx'),
        ),
        migrations.AddIndex(
            model_name='friendship',
            index=models.Index(fields=['to_user', 'status'], name='friendships_to_user_status_idx'),
        ),
    ]
