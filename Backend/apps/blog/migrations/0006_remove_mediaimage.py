"""
Remove o modelo MediaImage do app blog.
Os dados já foram copiados para media_files pela migration media/0002.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0005_comment_is_approved_default_false"),
        # Garante que os dados foram migrados para media_files antes de remover
        ("media", "0002_import_from_blog"),
    ]

    operations = [
        migrations.DeleteModel(
            name="MediaImage",
        ),
    ]
