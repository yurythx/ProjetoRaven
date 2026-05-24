from django.db import migrations, models


def _encrypt_existing(apps, schema_editor):
    """Encrypt any plaintext totp_secret values already in the database."""
    User = apps.get_model("accounts", "User")
    from apps.accounts.utils.encryption import encrypt_totp_secret
    for user in User.objects.exclude(totp_secret="").iterator():
        # Skip values that already look like Fernet tokens (start with 'gAAAAA')
        if not user.totp_secret.startswith("gAAAAA"):
            user.totp_secret = encrypt_totp_secret(user.totp_secret)
            user.save(update_fields=["totp_secret"])


def _noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_push_subscription"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="totp_secret",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.RunPython(_encrypt_existing, reverse_code=_noop),
    ]
