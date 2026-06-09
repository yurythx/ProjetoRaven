from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0008_post_search_vector"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="next_post",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="previous_posts",
                to="blog.post",
            ),
        ),
        migrations.AddField(
            model_name="post",
            name="previous_post",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="next_posts",
                to="blog.post",
            ),
        ),
    ]

