from django.db import migrations, models

import apps.media.models


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0003_alter_mediafile_image"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mediafile",
            name="image",
            field=models.ImageField(upload_to=apps.media.models._upload_path),
        ),
    ]

