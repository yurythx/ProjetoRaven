from django.contrib.syndication.views import Feed
from django.utils.feedgenerator import Atom1Feed
from django.conf import settings
from .models import Post

_SITE = getattr(settings, "SITE_URL", "").rstrip("/") or "https://ravenportal.com"
_LIMIT = 20


class LatestPostsFeed(Feed):
    title = "Projeto Raven — Blog"
    description = "Últimos artigos publicados no blog da comunidade Raven."
    feed_copyright = "Projeto Raven"

    @property
    def link(self):
        return f"{_SITE}/blog"

    def items(self):
        return (
            Post.objects.filter(status=Post.Status.PUBLISHED, is_public=True)
            .select_related("author")
            .order_by("-published_at")[:_LIMIT]
        )

    def item_title(self, post):
        return post.title

    def item_description(self, post):
        return post.excerpt or ""

    def item_link(self, post):
        return f"{_SITE}/blog/{post.slug}"

    def item_pubdate(self, post):
        return post.published_at

    def item_updateddate(self, post):
        return post.updated_at

    def item_author_name(self, post):
        if post.author:
            return post.author.display_name or post.author.username
        return None

    def item_categories(self, post):
        if post.category:
            return [post.category.name]
        return []

    def item_enclosures(self, post):
        if post.image:
            try:
                url = f"{_SITE}{post.image.url}"
                return [{"url": url, "length": 0, "mime_type": "image/jpeg"}]
            except Exception:
                pass
        return []


class LatestPostsAtomFeed(LatestPostsFeed):
    feed_type = Atom1Feed
    subtitle = LatestPostsFeed.description
