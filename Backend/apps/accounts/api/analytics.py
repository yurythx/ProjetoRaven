from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()


class AdminAnalyticsView(APIView):
    """
    GET /api/v1/accounts/admin/analytics/

    Aggregated platform metrics for the admin dashboard.
    Requires staff or superuser status.
    """

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        now = timezone.now()
        today_start   = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start    = today_start - timedelta(days=6)
        month_start   = today_start - timedelta(days=29)

        # ── Users ────────────────────────────────────────────────────────────
        user_qs = User.objects.all()
        total_users   = user_qs.count()
        new_today     = user_qs.filter(date_joined__gte=today_start).count()
        new_week      = user_qs.filter(date_joined__gte=week_start).count()
        new_month     = user_qs.filter(date_joined__gte=month_start).count()
        verified      = user_qs.filter(is_verified=True).count()
        banned        = user_qs.filter(is_banned=True).count()
        online_today  = user_qs.filter(last_login__gte=today_start).count()

        # Registrations per day — last 30 days
        reg_series = (
            user_qs.filter(date_joined__gte=month_start)
            .annotate(day=TruncDate("date_joined"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        registrations_chart = [
            {"date": str(r["day"]), "users": r["count"]} for r in reg_series
        ]

        # ── Content ──────────────────────────────────────────────────────────
        content_data = {}
        try:
            from apps.blog.models import Post
            from apps.forum.models import Topic, Reply
            content_data = {
                "blog_published":   Post.objects.filter(status="published").count(),
                "forum_topics":     Topic.objects.count(),
                "forum_replies_today": Reply.objects.filter(
                    created_at__gte=today_start
                ).count(),
            }
        except Exception:
            pass

        return Response(
            {
                "users": {
                    "total": total_users,
                    "new_today": new_today,
                    "new_week": new_week,
                    "new_month": new_month,
                    "verified": verified,
                    "banned": banned,
                    "online_today": online_today,
                },
                "content": content_data,
                "registrations_chart": registrations_chart,
                "generated_at": now.isoformat(),
            },
            status=status.HTTP_200_OK,
        )
