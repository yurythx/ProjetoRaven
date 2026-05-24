from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_alter_adminauditevent_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='admin_verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='admin_verified_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verified_users', to='accounts.user'),
        ),
        migrations.AddField(
            model_name='user',
            name='is_admin_verified',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_admin_verified'], name='users_is_admi_39000a_idx'),
        ),
    ]
