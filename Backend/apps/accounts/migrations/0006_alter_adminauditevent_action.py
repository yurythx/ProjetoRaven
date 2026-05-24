# Generated manually 2026-05-01

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_emailonetimecode_accounts_em_ip_addr_c65324_idx'),
    ]

    operations = [
        migrations.AlterField(
            model_name='adminauditevent',
            name='action',
            field=models.CharField(
                choices=[
                    ('create_user', 'Create User'),
                    ('register_user', 'Register User'),
                    ('email_verify_sent', 'Email Verify Sent'),
                    ('email_verified', 'Email Verified'),
                    ('password_reset_sent', 'Password Reset Sent'),
                    ('password_reset_confirmed', 'Password Reset Confirmed'),
                    ('activate', 'Activate'),
                    ('deactivate', 'Deactivate'),
                    ('ban', 'Ban'),
                    ('unban', 'Unban'),
                    ('reset_password', 'Reset Password'),
                    ('change_groups', 'Change Groups'),
                    ('update_user', 'Update User'),
                    ('unity_token_issued', 'Unity Token Issued'),
                ],
                db_index=True,
                max_length=32,
            ),
        ),
    ]
