import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_user_totp'),
    ]

    operations = [
        migrations.CreateModel(
            name='SocialAccount',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(
                    choices=[('google', 'Google'), ('discord', 'Discord')],
                    db_index=True,
                    max_length=20,
                )),
                ('provider_uid', models.CharField(db_index=True, max_length=255)),
                ('extra_data', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='social_accounts',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'accounts_social_accounts',
            },
        ),
        migrations.AddConstraint(
            model_name='socialaccount',
            constraint=models.UniqueConstraint(
                fields=['provider', 'provider_uid'],
                name='unique_social_provider_uid',
            ),
        ),
    ]
