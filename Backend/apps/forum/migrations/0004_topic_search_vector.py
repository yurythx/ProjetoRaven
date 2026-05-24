from django.contrib.postgres.indexes import GinIndex
from django.db import migrations
import django.contrib.postgres.search


_CREATE_TRIGGER_FUNCTION = """
CREATE OR REPLACE FUNCTION forum_topic_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'B');
    RETURN NEW;
END;
$$;
"""

_CREATE_TRIGGER = """
CREATE TRIGGER forum_topic_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, content
ON forum_topics
FOR EACH ROW EXECUTE FUNCTION forum_topic_search_vector_update();
"""

_DROP_TRIGGER = "DROP TRIGGER IF EXISTS forum_topic_search_vector_trigger ON forum_topics;"
_DROP_FUNCTION = "DROP FUNCTION IF EXISTS forum_topic_search_vector_update();"

_BACKFILL = """
UPDATE forum_topics SET search_vector =
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(content, '')), 'B');
"""


def _apply_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(_CREATE_TRIGGER_FUNCTION)
    schema_editor.execute(_CREATE_TRIGGER)
    schema_editor.execute(_BACKFILL)


def _drop_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(_DROP_TRIGGER)
    schema_editor.execute(_DROP_FUNCTION)


class Migration(migrations.Migration):

    dependencies = [
        ("forum", "0003_alter_forumcategory_slug_alter_topic_slug"),
    ]

    operations = [
        migrations.AddField(
            model_name="topic",
            name="search_vector",
            field=django.contrib.postgres.search.SearchVectorField(editable=False, null=True),
        ),
        migrations.AddIndex(
            model_name="topic",
            index=GinIndex(
                fields=["search_vector"],
                name="forum_topic_search_vector_idx",
            ),
        ),
        migrations.RunPython(_apply_trigger, reverse_code=_drop_trigger),
    ]
