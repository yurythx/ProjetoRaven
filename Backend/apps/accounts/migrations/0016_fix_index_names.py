from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0015_user_avatar"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="totprecoverycode",
            new_name="accounts_to_user_id_723aa5_idx",
            old_name="accounts_to_user_id_used_at_idx",
        ),
        migrations.AlterField(
            model_name="pushsubscription",
            name="id",
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
        ),
    ]
