from django.core.cache import caches
from django.db import connections
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone


class HealthLiveView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        return Response({"status": "ok"})


class HealthReadyView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        checks = {
            "db": self._check_database(),
            "cache": self._check_cache(),
            "redis": self._check_redis(),
            "celery": self._check_celery(),
        }

        all_ok = all(checks.values())
        status_code = 200 if all_ok else 503

        return Response(
            {
                "status": "ok" if all_ok else "degraded",
                "checks": checks,
                "timestamp": timezone.now().isoformat(),
            },
            status=status_code,
        )

    def _check_database(self) -> bool:
        try:
            conn = connections["default"]
            conn.ensure_connection()
            return True
        except Exception:
            return False

    def _check_cache(self) -> bool:
        try:
            cache = caches["default"]
            cache.set("__healthcheck__", "1", timeout=2)
            v = cache.get("__healthcheck__")
            return v == "1"
        except Exception:
            return False

    def _check_redis(self) -> bool:
        try:
            from django_redis import get_redis_connection
            r = get_redis_connection("default")
            r.ping()
            return True
        except Exception:
            return False

    def _check_celery(self) -> bool:
        try:
            from django.conf import settings
            if not getattr(settings, "CELERY_BROKER_URL", ""):
                return True
            from celery import current_app
            replies = current_app.control.ping(timeout=1.0)
            return bool(replies)
        except Exception:
            return False


class HealthDetailedView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        from django.contrib.auth import get_user_model
        from apps.accounts.models import Friendship
        
        checks = {
            "db": self._check_database(),
            "cache": self._check_cache(),
            "redis": self._check_redis(),
            "smtp": self._check_smtp(),
            "celery": self._check_celery(),
        }
        
        stats = {
            "total_users": self._count_users(),
            "total_posts": self._count_posts(),
        }
        
        all_ok = all(checks.values())
        
        return Response(
            {
                "status": "ok" if all_ok else "degraded",
                "checks": checks,
                "stats": stats,
                "timestamp": timezone.now().isoformat(),
                "version": getattr(settings, "APP_VERSION", "unknown"),
                "environment": getattr(settings, "ENVIRONMENT", "production"),
            },
            status=200 if all_ok else 503,
        )
    
    def _check_database(self) -> bool:
        try:
            conn = connections["default"]
            conn.ensure_connection()
            return True
        except Exception:
            return False
    
    def _check_cache(self) -> bool:
        try:
            cache = caches["default"]
            cache.set("__healthcheck__", "1", timeout=2)
            v = cache.get("__healthcheck__")
            return v == "1"
        except Exception:
            return False
    
    def _check_redis(self) -> bool:
        try:
            from django_redis import get_redis_connection
            r = get_redis_connection("default")
            r.ping()
            return True
        except Exception:
            return False

    def _check_celery(self) -> bool:
        try:
            from django.conf import settings
            if not getattr(settings, "CELERY_BROKER_URL", ""):
                return True
            from celery import current_app
            replies = current_app.control.ping(timeout=1.0)
            return bool(replies)
        except Exception:
            return False
    
    def _check_smtp(self) -> bool:
        try:
            from django.core.mail import get_connection
            from django.conf import settings
            
            email_host = getattr(settings, "EMAIL_HOST", None)
            if not email_host:
                return True
            
            connection = get_connection()
            connection.open()
            connection.close()
            return True
        except Exception:
            return False
    
    def _count_users(self) -> int:
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            return User.objects.count()
        except Exception:
            return -1
    
    def _count_posts(self) -> int:
        try:
            from apps.blog.models import Post
            return Post.objects.count()
        except Exception:
            return -1


class HealthVersionView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        return Response(
            {
                "version": getattr(settings, "APP_VERSION", None),
                "build_sha": getattr(settings, "APP_BUILD_SHA", None),
                "build_time": getattr(settings, "APP_BUILD_TIME", None),
            }
        )
