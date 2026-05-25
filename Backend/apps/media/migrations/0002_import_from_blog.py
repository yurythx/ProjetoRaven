"""
Data migration: copia registros de blog_media_images para media_files.
Preserva id, image e created_at originais.
"""
from django.db import migrations


def copy_blog_media_images(apps, schema_editor):
    db = schema_editor.connection.alias

    # Acessa o modelo legado via apps registry (sem importar diretamente)
    try:
        MediaImage = apps.get_model("blog", "MediaImage")
    except LookupError:
        return  # blog.MediaImage já foi removido — nada a fazer

    MediaFile = apps.get_model("media", "MediaFile")

    existing_ids = set(MediaFile.objects.using(db).values_list("id", flat=True))

    to_create = []
    for old in MediaImage.objects.using(db).all():
        if old.id in existing_ids:
            continue
        to_create.append(
            MediaFile(
                id=old.id,
                image=old.image,
                alt_text="",
                original_filename="",
                created_at=old.created_at,
            )
        )

    if to_create:
        MediaFile.objects.using(db).bulk_create(to_create, ignore_conflicts=True)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("media", "0001_initial"),
        ("blog", "0003_mediaimage_postrevision"),
    ]

    operations = [
        migrations.RunPython(copy_blog_media_images, reverse_code=noop),
    ]
