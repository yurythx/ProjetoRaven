from django.db.models import Q, Value, CharField
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle


class GlobalSearchView(APIView):
    """
    GET /api/v1/search/?q=<query>&limit=10

    Returns up to `limit` results per type (blog posts + forum topics),
    sorted by relevance (simple icontains fallback; full-text on Postgres).
    """
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q or len(q) < 2:
            return Response({"posts": [], "topics": [], "query": q})

        limit = min(int(request.query_params.get("limit", 10)), 20)

        posts = self._search_posts(q, limit)
        topics = self._search_topics(q, limit)

        return Response({"query": q, "posts": posts, "topics": topics})

    def _search_posts(self, q: str, limit: int) -> list:
        from apps.blog.models import Post

        qs = (
            Post.objects.filter(
                Q(title__icontains=q) | Q(excerpt__icontains=q),
                status=Post.Status.PUBLISHED,
                is_public=True,
            )
            .select_related("author")
            .only("slug", "title", "excerpt", "published_at", "image", "author__username", "author__display_name")
            .order_by("-published_at")[:limit]
        )

        results = []
        for p in qs:
            image = None
            if p.image:
                try:
                    image = self.request.build_absolute_uri(p.image.url)
                except Exception:
                    pass
            results.append({
                "type": "post",
                "slug": p.slug,
                "title": p.title,
                "excerpt": (p.excerpt or "")[:200],
                "published_at": p.published_at,
                "image": image,
                "author": getattr(p.author, "display_name", None) or getattr(p.author, "username", ""),
                "url": f"/blog/{p.slug}",
            })
        return results

    def _search_topics(self, q: str, limit: int) -> list:
        from apps.forum.models import Topic
        from django.db import connection

        qs = Topic.objects.filter(
            category__is_active=True,
            status__in=["open", "closed"],
        ).select_related("author", "category").only(
            "slug", "title", "created_at", "reply_count",
            "author__username", "author__display_name",
            "category__name", "category__slug",
        )

        # Full-text on Postgres, icontains fallback
        if connection.vendor == "postgresql":
            try:
                from django.contrib.postgres.search import SearchQuery, SearchRank
                sq = SearchQuery(q, config="portuguese")
                qs = (
                    qs.filter(search_vector=sq)
                    .annotate(rank=SearchRank("search_vector", sq))
                    .order_by("-rank")[:limit]
                )
            except Exception:
                qs = qs.filter(Q(title__icontains=q) | Q(content__icontains=q)).order_by("-created_at")[:limit]
        else:
            qs = qs.filter(Q(title__icontains=q) | Q(content__icontains=q)).order_by("-created_at")[:limit]

        return [
            {
                "type": "topic",
                "slug": t.slug,
                "title": t.title,
                "created_at": t.created_at,
                "reply_count": t.reply_count,
                "category_name": t.category.name,
                "category_slug": t.category.slug,
                "author": getattr(t.author, "display_name", None) or getattr(t.author, "username", ""),
                "url": f"/forum/t/{t.slug}",
            }
            for t in qs
        ]
