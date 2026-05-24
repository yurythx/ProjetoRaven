from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("forum", "0005_remove_search_vector_idx"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="topic",
            index=models.Index(
                fields=["category", "-is_pinned", "-last_reply_at"],
                name="forum_topic_cat_pin_reply_idx",
            ),
        ),
    ]
