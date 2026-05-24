from django.test import SimpleTestCase

from apps.common.html_sanitizer import sanitize_html


class HtmlSanitizerTestCase(SimpleTestCase):
    def test_strips_script_tags(self):
        html = '<p>Hello</p><script>alert("x")</script>'
        out = sanitize_html(html)
        self.assertIn("<p>Hello</p>", out)
        self.assertNotIn("<script", out)
        self.assertNotIn("</script>", out)

    def test_strips_event_handler_attributes(self):
        html = '<img src="https://example.com/x.png" onerror="alert(1)" />'
        out = sanitize_html(html)
        self.assertIn("img", out)
        self.assertNotIn("onerror", out)

    def test_blocks_javascript_urls(self):
        html = '<a href="javascript:alert(1)">click</a>'
        out = sanitize_html(html)
        self.assertNotIn("javascript:", out)

    def test_allows_only_safe_css_properties(self):
        html = '<div style="position:fixed;color:red;background-color:#fff">x</div>'
        out = sanitize_html(html)
        self.assertIn("color", out)
        self.assertNotIn("position", out)
