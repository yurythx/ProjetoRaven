from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blog.models import Post
from apps.media.models import MediaFile


class MediaDeleteInUseTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        editor_group, _ = Group.objects.get_or_create(name="editors")
        self.editor = User.objects.create_user(
            email="editor_delete@example.com",
            username="editor_delete",
            password="Pass1234!",
        )
        self.editor.groups.add(editor_group)
        self.client.force_authenticate(user=self.editor)

    def test_cannot_delete_media_used_as_cover(self):
        mf = MediaFile.objects.create(image="uploads/inuse.png", original_filename="inuse.png")
        Post.objects.create(
            title="T",
            slug="t",
            excerpt="E",
            content="C",
            author=self.editor,
            image=mf.image.name,
        )
        res = self.client.delete(f"/api/v1/media/files/{mf.id}/")
        self.assertEqual(res.status_code, 409)
        body = res.json()
        self.assertIn("used_by", body)
        self.assertTrue(any(x.get("slug") == "t" for x in body["used_by"]["cover_posts"]))

    def test_cannot_delete_media_used_in_content(self):
        mf = MediaFile.objects.create(image="uploads/incontent.png", original_filename="incontent.png")
        Post.objects.create(
            title="T2",
            slug="t2",
            excerpt="E2",
            content=f'<p><img src="/media/{mf.image.name}" /></p>',
            author=self.editor,
        )
        res = self.client.delete(f"/api/v1/media/files/{mf.id}/")
        self.assertEqual(res.status_code, 409)
        body = res.json()
        self.assertIn("used_by", body)
        self.assertTrue(any(x.get("slug") == "t2" for x in body["used_by"]["content_posts"]))
