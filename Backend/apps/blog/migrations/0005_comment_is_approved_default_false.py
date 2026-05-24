from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0004_posts_force_public"),
    ]

    operations = [
        migrations.AlterField(
            model_name="comment",
            name="is_approved",
            field=models.BooleanField(default=False, db_index=True),
        ),
    ]

