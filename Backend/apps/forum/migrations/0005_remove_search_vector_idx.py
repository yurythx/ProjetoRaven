from django.contrib.postgres.indexes import GinIndex
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("forum", "0004_topic_search_vector"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="topic",
            name="forum_topic_search_vector_idx",
        ),
    ]
