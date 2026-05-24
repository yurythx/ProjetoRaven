from django.db import migrations


def force_posts_public(apps, schema_editor):
    Post = apps.get_model("blog", "Post")
    Post.objects.update(is_public=True)


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0003_mediaimage_postrevision"),
    ]

    operations = [
        migrations.RunPython(force_posts_public, migrations.RunPython.noop),
    ]

