from django.db import migrations, models


def _fill_media_dimensions(apps, schema_editor):
    MediaFile = apps.get_model("media", "MediaFile")
    for mf in MediaFile.objects.filter(width__isnull=True, height__isnull=True).iterator():
        try:
            if not mf.image:
                continue
            path = mf.image.path
            from PIL import Image as PilImage

            with PilImage.open(path) as img:
                w, h = img.size
            MediaFile.objects.filter(id=mf.id).update(width=w, height=h)
        except Exception:
            continue


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0003_alter_mediafile_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="mediafile",
            name="height",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="width",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(_fill_media_dimensions, migrations.RunPython.noop),
    ]
