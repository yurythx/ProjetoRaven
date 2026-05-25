"""
Advanced forum tests — covers update, edit, reactions via API, reply-to-locked,
popular endpoint, with_replies pagination, category update, and serializer validation.
These tests are designed to bring forum coverage to ≥80%.
"""
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.forum.models import ForumCategory, Reply, Topic
from apps.forum.services import ForumCategoryService, TopicService


def _make_user(email, username, verified=True):
    u = User.objects.create_user(email=email, username=username, password="TestPass123!")
    if verified:
        u.is_verified = True
        u.save(update_fields=["is_verified"])
    members_group, _ = Group.objects.get_or_create(name="members")
    u.groups.add(members_group)
    return u


class TopicUpdateTestCase(TestCase):
    """Tests for PATCH/PUT on topics — author and moderator access."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")
        self.mods_group, _ = Group.objects.get_or_create(name="forum_moderators")

        self.author = _make_user("author@test.com", "author")
        self.other = _make_user("other@test.com", "other")
        self.mod = _make_user("mod@test.com", "mod")
        self.mod.groups.add(self.mods_group)

        self.category = ForumCategory.objects.create(name="General", slug="general", is_active=True)
        self.topic = TopicService.create_topic(
            title="Original Title",
            content="<p>Content</p>",
            category=self.category,
            author=self.author,
        )

    def test_author_can_patch_own_topic(self):
        self.client.force_authenticate(user=self.author)
        res = self.client.patch(
            f"/api/v1/forum/topics/{self.topic.slug}/",
            {"title": "Updated Title"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.topic.refresh_from_db()
        self.assertEqual(self.topic.title, "Updated Title")

    def test_other_user_cannot_patch_topic(self):
        self.client.force_authenticate(user=self.other)
        res = self.client.patch(
            f"/api/v1/forum/topics/{self.topic.slug}/",
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_moderator_can_patch_any_topic(self):
        self.client.force_authenticate(user=self.mod)
        res = self.client.patch(
            f"/api/v1/forum/topics/{self.topic.slug}/",
            {"title": "Mod Edit"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_unauthenticated_cannot_patch(self):
        res = self.client.patch(
            f"/api/v1/forum/topics/{self.topic.slug}/",
            {"title": "Anon edit"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)

    def test_author_can_delete_own_topic(self):
        self.client.force_authenticate(user=self.author)
        res = self.client.delete(f"/api/v1/forum/topics/{self.topic.slug}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Topic.objects.filter(id=self.topic.id).exists())

    def test_other_user_cannot_delete_topic(self):
        self.client.force_authenticate(user=self.other)
        res = self.client.delete(f"/api/v1/forum/topics/{self.topic.slug}/")
        self.assertEqual(res.status_code, 403)


class ReplyUpdateTestCase(TestCase):
    """Tests for PATCH on replies — author and moderator access."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")
        self.mods_group, _ = Group.objects.get_or_create(name="forum_moderators")

        self.author = _make_user("rep_author@test.com", "rep_author")
        self.other = _make_user("rep_other@test.com", "rep_other")
        self.mod = _make_user("rep_mod@test.com", "rep_mod")
        self.mod.groups.add(self.mods_group)

        self.category = ForumCategory.objects.create(name="Help", slug="help", is_active=True)
        self.topic = TopicService.create_topic(
            title="Help me",
            content="<p>Help</p>",
            category=self.category,
            author=self.author,
        )
        self.reply = TopicService.create_reply(
            topic=self.topic,
            content="<p>My reply</p>",
            author=self.author,
        )

    def test_author_can_patch_own_reply(self):
        self.client.force_authenticate(user=self.author)
        res = self.client.patch(
            f"/api/v1/forum/replies/{self.reply.id}/",
            {"content": "<p>Updated reply</p>"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_other_user_cannot_patch_reply(self):
        self.client.force_authenticate(user=self.other)
        res = self.client.patch(
            f"/api/v1/forum/replies/{self.reply.id}/",
            {"content": "<p>Hijacked</p>"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_moderator_can_patch_any_reply(self):
        self.client.force_authenticate(user=self.mod)
        res = self.client.patch(
            f"/api/v1/forum/replies/{self.reply.id}/",
            {"content": "<p>Mod patched</p>"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)


class TopicCloseOpenViaViewTestCase(TestCase):
    """Tests for topic close/open/archive moderator actions."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")
        self.mods_group, _ = Group.objects.get_or_create(name="forum_moderators")

        self.player = _make_user("player_co@test.com", "player_co")
        self.mod = _make_user("mod_co@test.com", "mod_co")
        self.mod.groups.add(self.mods_group)

        self.category = ForumCategory.objects.create(name="Cats", slug="cats", is_active=True)
        self.topic = TopicService.create_topic(
            title="My Topic",
            content="<p>Content</p>",
            category=self.category,
            author=self.player,
        )

    def test_moderator_can_close_and_open_topic(self):
        self.client.force_authenticate(user=self.mod)

        res = self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/close/")
        self.assertEqual(res.status_code, 200)
        self.topic.refresh_from_db()
        self.assertTrue(self.topic.is_locked)

        res = self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/open/")
        self.assertEqual(res.status_code, 200)
        self.topic.refresh_from_db()
        self.assertFalse(self.topic.is_locked)

    def test_player_cannot_close_topic(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/close/")
        self.assertEqual(res.status_code, 403)

    def test_moderator_can_unpin_topic(self):
        self.client.force_authenticate(user=self.mod)
        self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/pin/")
        self.topic.refresh_from_db()
        self.assertTrue(self.topic.is_pinned)

        res = self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/unpin/")
        self.assertEqual(res.status_code, 200)
        self.topic.refresh_from_db()
        self.assertFalse(self.topic.is_pinned)


class ReplyCreationToLockedTopicViaViewTestCase(TestCase):
    """Tests creating a reply to a locked topic via API returns 400."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")
        self.mods_group, _ = Group.objects.get_or_create(name="forum_moderators")

        self.player = _make_user("p_lock@test.com", "p_lock")
        self.mod = _make_user("m_lock@test.com", "m_lock")
        self.mod.groups.add(self.mods_group)

        self.category = ForumCategory.objects.create(name="Locked", slug="locked-cat", is_active=True)
        self.topic = TopicService.create_topic(
            title="Locked Topic",
            content="<p>x</p>",
            category=self.category,
            author=self.player,
        )
        self.client.force_authenticate(user=self.mod)
        self.client.post(f"/api/v1/forum/topics/{self.topic.slug}/close/")
        self.topic.refresh_from_db()
        self.assertTrue(self.topic.is_locked)

    def test_reply_to_locked_topic_returns_400(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            "/api/v1/forum/replies/",
            {"content": "<p>Reply</p>", "topic": str(self.topic.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.json())


class TopicPopularEndpointTestCase(TestCase):
    """Tests for the /topics/popular/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")

        self.player = _make_user("pop_player@test.com", "pop_player")
        self.category = ForumCategory.objects.create(name="Popular", slug="popular", is_active=True)

        for i in range(3):
            TopicService.create_topic(
                title=f"Topic {i}",
                content="<p>Content</p>",
                category=self.category,
                author=self.player,
            )

    def test_popular_endpoint_returns_list(self):
        res = self.client.get("/api/v1/forum/topics/popular/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)

    def test_popular_endpoint_respects_limit(self):
        res = self.client.get("/api/v1/forum/topics/popular/?limit=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertLessEqual(len(data), 2)


class TopicWithRepliesEndpointTestCase(TestCase):
    """Tests for /topics/{slug}/with_replies/ — paginated replies."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")

        self.player = _make_user("wr_player@test.com", "wr_player")
        self.category = ForumCategory.objects.create(name="WR", slug="wr", is_active=True)
        self.topic = TopicService.create_topic(
            title="With Replies",
            content="<p>Content</p>",
            category=self.category,
            author=self.player,
        )
        for i in range(5):
            TopicService.create_reply(topic=self.topic, content=f"<p>Reply {i}</p>", author=self.player)

    def test_with_replies_returns_topic_and_replies(self):
        res = self.client.get(f"/api/v1/forum/topics/{self.topic.slug}/with_replies/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("topic", data)
        self.assertIn("replies", data)
        self.assertEqual(len(data["replies"]), 5)

    def test_with_replies_increments_view_count(self):
        before = self.topic.view_count
        self.client.get(f"/api/v1/forum/topics/{self.topic.slug}/with_replies/")
        self.topic.refresh_from_db()
        self.assertEqual(self.topic.view_count, before + 1)

    def test_with_replies_respects_page_size(self):
        res = self.client.get(f"/api/v1/forum/topics/{self.topic.slug}/with_replies/?page_size=2&page=1")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertLessEqual(len(data["replies"]), 2)

    def test_with_replies_not_found(self):
        res = self.client.get("/api/v1/forum/topics/nonexistent-slug/with_replies/")
        self.assertEqual(res.status_code, 404)


class ReplyReactEndpointTestCase(TestCase):
    """Tests for /replies/{id}/react/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")

        self.player = _make_user("react_player@test.com", "react_player")
        self.category = ForumCategory.objects.create(name="React", slug="react", is_active=True)
        self.topic = TopicService.create_topic(
            title="React Topic",
            content="<p>x</p>",
            category=self.category,
            author=self.player,
        )
        self.reply = TopicService.create_reply(
            topic=self.topic, content="<p>Reply</p>", author=self.player
        )

    def test_authenticated_user_can_react(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/v1/forum/replies/{self.reply.id}/react/",
            {"reaction": "like"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)

    def test_react_twice_removes_reaction(self):
        self.client.force_authenticate(user=self.player)
        self.client.post(f"/api/v1/forum/replies/{self.reply.id}/react/", {"reaction": "like"}, format="json")
        res = self.client.post(f"/api/v1/forum/replies/{self.reply.id}/react/", {"reaction": "like"}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_unauthenticated_cannot_react(self):
        res = self.client.post(
            f"/api/v1/forum/replies/{self.reply.id}/react/",
            {"reaction": "like"},
            format="json",
        )
        self.assertIn(res.status_code, [401, 403])

    def test_invalid_reaction_returns_400(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            f"/api/v1/forum/replies/{self.reply.id}/react/",
            {"reaction": "invalid_type"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)


class CategoryUpdateTestCase(TestCase):
    """Tests for moderator updating a category."""

    def setUp(self):
        self.client = APIClient()
        self.mods_group, _ = Group.objects.get_or_create(name="forum_moderators")

        self.player = _make_user("cat_player@test.com", "cat_player")
        self.mod = _make_user("cat_mod@test.com", "cat_mod")
        self.mod.groups.add(self.mods_group)

        self.category = ForumCategory.objects.create(name="Old Name", slug="old-name", is_active=True)

    def test_moderator_can_update_category(self):
        self.client.force_authenticate(user=self.mod)
        res = self.client.patch(
            f"/api/v1/forum/categories/{self.category.slug}/",
            {"name": "New Name"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.category.refresh_from_db()
        self.assertEqual(self.category.name, "New Name")

    def test_player_cannot_update_category(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.patch(
            f"/api/v1/forum/categories/{self.category.slug}/",
            {"name": "Hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_moderator_can_deactivate_category(self):
        self.client.force_authenticate(user=self.mod)
        res = self.client.patch(
            f"/api/v1/forum/categories/{self.category.slug}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.category.refresh_from_db()
        self.assertFalse(self.category.is_active)


class ReplyListFilterTestCase(TestCase):
    """Tests for filtering replies by topic slug."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")

        self.player = _make_user("filter_player@test.com", "filter_player")
        self.category = ForumCategory.objects.create(name="Filter", slug="filter", is_active=True)

        self.topic_a = TopicService.create_topic(
            title="Topic A", content="<p>A</p>", category=self.category, author=self.player
        )
        self.topic_b = TopicService.create_topic(
            title="Topic B", content="<p>B</p>", category=self.category, author=self.player
        )
        self.reply_a = TopicService.create_reply(topic=self.topic_a, content="<p>Reply A</p>", author=self.player)
        self.reply_b = TopicService.create_reply(topic=self.topic_b, content="<p>Reply B</p>", author=self.player)

    def test_filter_replies_by_topic_slug(self):
        res = self.client.get(f"/api/v1/forum/replies/?topic={self.topic_a.slug}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        results = data.get("results", data)
        ids = [item["id"] for item in results]
        self.assertIn(str(self.reply_a.id), ids)
        self.assertNotIn(str(self.reply_b.id), ids)

    def test_retrieve_single_reply(self):
        res = self.client.get(f"/api/v1/forum/replies/{self.reply_a.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["id"], str(self.reply_a.id))


class TopicSearchFilterTestCase(TestCase):
    """Tests for topic list filters."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")

        self.player = _make_user("search_player@test.com", "search_player")
        self.cat_a = ForumCategory.objects.create(name="CatA", slug="cat-a", is_active=True)
        self.cat_b = ForumCategory.objects.create(name="CatB", slug="cat-b", is_active=True)
        self.inactive = ForumCategory.objects.create(name="Inactive", slug="inactive", is_active=False)

        self.topic_a = TopicService.create_topic(
            title="Topic in A", content="<p>x</p>", category=self.cat_a, author=self.player
        )
        self.topic_b = TopicService.create_topic(
            title="Topic in B", content="<p>y</p>", category=self.cat_b, author=self.player
        )

    def test_list_returns_all_active_topics(self):
        res = self.client.get("/api/v1/forum/topics/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        results = data.get("results", data)
        slugs = [t["slug"] for t in results]
        self.assertIn(self.topic_a.slug, slugs)
        self.assertIn(self.topic_b.slug, slugs)

    def test_filter_by_category_slug(self):
        res = self.client.get(f"/api/v1/forum/topics/?category={self.cat_a.slug}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        results = data.get("results", data)
        slugs = [t["slug"] for t in results]
        self.assertIn(self.topic_a.slug, slugs)
        self.assertNotIn(self.topic_b.slug, slugs)

    def test_filter_by_category_uuid(self):
        res = self.client.get(f"/api/v1/forum/topics/?category={self.cat_b.id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        results = data.get("results", data)
        slugs = [t["slug"] for t in results]
        self.assertIn(self.topic_b.slug, slugs)
        self.assertNotIn(self.topic_a.slug, slugs)

    def test_topic_retrieve_returns_detail_serializer(self):
        res = self.client.get(f"/api/v1/forum/topics/{self.topic_a.slug}/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["slug"], self.topic_a.slug)
        self.assertIn("content", data)


class SerializerSanitizationTestCase(TestCase):
    """Tests that HTML is sanitized when creating topics and replies."""

    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="members")
        self.player = _make_user("san_player@test.com", "san_player")
        self.category = ForumCategory.objects.create(name="Sanitize", slug="sanitize", is_active=True)

    def test_script_tag_stripped_from_topic(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.post(
            "/api/v1/forum/topics/",
            {
                "title": "XSS Topic",
                "content": "<p>Safe</p><script>alert('xss')</script>",
                "category": str(self.category.id),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        topic = Topic.objects.get(slug=res.json()["slug"])
        self.assertNotIn("<script>", topic.content)

    def test_script_tag_stripped_from_reply(self):
        self.client.force_authenticate(user=self.player)
        topic = TopicService.create_topic(
            title="Safe Topic", content="<p>x</p>", category=self.category, author=self.player
        )
        res = self.client.post(
            "/api/v1/forum/replies/",
            {"content": "<p>Safe</p><script>evil()</script>", "topic": str(topic.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        reply = Reply.objects.get(id=res.json()["id"])
        self.assertNotIn("<script>", reply.content)


class CategoryDeleteTestCase(TestCase):
    """Tests for category deletion by moderator."""

    def setUp(self):
        self.client = APIClient()
        self.mods_group, _ = Group.objects.get_or_create(name="forum_moderators")
        self.mod = _make_user("del_mod@test.com", "del_mod")
        self.mod.groups.add(self.mods_group)
        self.player = _make_user("del_player@test.com", "del_player")
        self.category = ForumCategory.objects.create(name="Delete Me", slug="delete-me", is_active=True)

    def test_moderator_can_delete_category(self):
        self.client.force_authenticate(user=self.mod)
        res = self.client.delete(f"/api/v1/forum/categories/{self.category.slug}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(ForumCategory.objects.filter(id=self.category.id).exists())

    def test_player_cannot_delete_category(self):
        self.client.force_authenticate(user=self.player)
        res = self.client.delete(f"/api/v1/forum/categories/{self.category.slug}/")
        self.assertEqual(res.status_code, 403)
