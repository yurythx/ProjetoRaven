"""
Tests for media upload security:
  - Only editors/staff can upload
  - MIME type allowlist is enforced
  - File size limit (10 MB) is enforced
  - UUID-based random filename prevents path traversal
"""
import io
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


def _make_user(suffix, is_staff=False):
    user = User.objects.create_user(
        email=f"u_{suffix}@example.com",
        username=f"u_{suffix}",
        password="Pass1234!",
        is_staff=is_staff,
    )
    return user


_IMAGE_MIME_TYPES = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"})
_PIL_FORMAT = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP", "image/gif": "GIF"}


def _fake_image(content_type="image/png", size_bytes=1024, filename="test.png"):
    if content_type in _IMAGE_MIME_TYPES:
        from PIL import Image as PilImage
        fmt = _PIL_FORMAT.get(content_type, "PNG")
        pil_img = PilImage.new("RGB", (10, 10), color=(100, 100, 100))
        buf = io.BytesIO()
        pil_img.save(buf, format=fmt)
        current = buf.tell()
        if size_bytes > current:
            buf.write(b"\x00" * (size_bytes - current))
        buf.seek(0)
    else:
        buf = io.BytesIO(b"not a real image " + b"\x00" * max(0, size_bytes - 17))
    buf.name = filename
    buf.content_type = content_type
    return buf


class MediaUploadPermissionTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.editor_group, _ = Group.objects.get_or_create(name="editors")
        self.blog_editor_group, _ = Group.objects.get_or_create(name="blog_editors")
        self.editor = _make_user("editor")
        self.editor.groups.add(self.editor_group)
        self.blog_editor = _make_user("blog_editor")
        self.blog_editor.groups.add(self.blog_editor_group)
        self.regular = _make_user("regular")
        self.staff = _make_user("staff", is_staff=True)

    @patch("apps.media.models.MediaFile.save", MagicMock())
    def test_editor_can_upload(self):
        self.client.force_authenticate(user=self.editor)
        img = _fake_image()
        res = self.client.post(
            "/api/v1/media/files/",
            {"image": img},
            format="multipart",
        )
        self.assertIn(res.status_code, [200, 201])

    @patch("apps.media.models.MediaFile.save", MagicMock())
    def test_blog_editor_can_upload(self):
        self.client.force_authenticate(user=self.blog_editor)
        img = _fake_image()
        res = self.client.post(
            "/api/v1/media/files/",
            {"image": img},
            format="multipart",
        )
        self.assertIn(res.status_code, [200, 201])

    @patch("apps.media.models.MediaFile.save", MagicMock())
    def test_staff_can_upload(self):
        self.client.force_authenticate(user=self.staff)
        img = _fake_image()
        res = self.client.post(
            "/api/v1/media/files/",
            {"image": img},
            format="multipart",
        )
        self.assertIn(res.status_code, [200, 201])

    def test_regular_user_cannot_upload(self):
        self.client.force_authenticate(user=self.regular)
        img = _fake_image()
        res = self.client.post(
            "/api/v1/media/files/",
            {"image": img},
            format="multipart",
        )
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_cannot_upload(self):
        img = _fake_image()
        res = self.client.post(
            "/api/v1/media/files/",
            {"image": img},
            format="multipart",
        )
        self.assertEqual(res.status_code, 401)


class MediaUploadMimeTypeTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        editor_group, _ = Group.objects.get_or_create(name="editors")
        self.editor = _make_user("mime_editor")
        self.editor.groups.add(editor_group)
        self.client.force_authenticate(user=self.editor)

    def _upload(self, content_type, filename="file"):
        img = _fake_image(content_type=content_type, filename=filename)
        return self.client.post(
            "/api/v1/media/files/",
            {"image": img},
            format="multipart",
        )

    @patch("apps.media.models.MediaFile.save", MagicMock())
    def test_jpeg_allowed(self):
        res = self._upload("image/jpeg", "photo.jpg")
        self.assertIn(res.status_code, [200, 201])

    @patch("apps.media.models.MediaFile.save", MagicMock())
    def test_webp_allowed(self):
        res = self._upload("image/webp", "photo.webp")
        self.assertIn(res.status_code, [200, 201])

    def test_svg_blocked(self):
        res = self._upload("image/svg+xml", "evil.svg")
        self.assertEqual(res.status_code, 400)

    def test_pdf_blocked(self):
        res = self._upload("application/pdf", "doc.pdf")
        self.assertEqual(res.status_code, 400)

    def test_executable_blocked(self):
        res = self._upload("application/x-msdownload", "virus.exe")
        self.assertEqual(res.status_code, 400)


class MediaUploadSizeLimitTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        editor_group, _ = Group.objects.get_or_create(name="editors")
        self.editor = _make_user("size_editor")
        self.editor.groups.add(editor_group)
        self.client.force_authenticate(user=self.editor)

    def test_oversized_file_rejected(self):
        # 11 MB — over the 10 MB limit
        big = _fake_image(size_bytes=11 * 1024 * 1024)
        res = self.client.post(
            "/api/v1/media/files/",
            {"image": big},
            format="multipart",
        )
        self.assertEqual(res.status_code, 400)


class MediaUploadPathTraversalTestCase(TestCase):
    """UUID-based filenames prevent path traversal."""

    def test_upload_path_uses_uuid(self):
        from apps.media.models import _upload_path

        mock_instance = MagicMock()
        filename = "../../etc/passwd"
        result = _upload_path(mock_instance, filename)

        self.assertNotIn("..", result)
        self.assertNotIn("passwd", result)
        self.assertTrue(result.startswith("uploads/"))
        # Should end with the original extension or a UUID-based name
        self.assertIn("/", result)
