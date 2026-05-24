from django.core.cache import cache
from functools import wraps
import hashlib
import json
from typing import Callable, Any, Optional


class CacheKeys:
    """Constantes para keys de cache."""
    
    BLOG_POST_LIST = "blog:posts:list:{page}"
    BLOG_POST_DETAIL = "blog:post:{slug}"
    BLOG_CATEGORIES = "blog:categories:all"
    
    FORUM_CATEGORIES = "forum:categories:all"
    FORUM_TOPIC_LIST = "forum:topics:category:{category_id}:page:{page}"
    FORUM_TOPIC_DETAIL = "forum:topic:{id}"
    
    GAME_DATA_ITEMS = "game:items:all"
    GAME_DATA_SKILLS = "game:skills:all"
    GAME_DATA_MAPS = "game:maps:all"
    GAME_DATA_BOOTSTRAP = "game:bootstrap:v{version}"
    
    GAME_LEADERBOARD = "game:leaderboard:{metric}:{limit}"
    GAME_CHARACTER_STATS = "game:char:{id}:stats"
    
    USER_PROFILE = "user:{id}:profile"


class CacheService:
    """Serviço centralizado de cache.
    
    Uso:
        cache_service = CacheService()
        
        # Get ou set
        data = cache_service.get_or_set(
            "key",
            lambda: expensive_operation(),
            timeout=300
        )
        
        # Decorator
        @cache_service.cached("key:{id}", timeout=60)
        def get_expensive_data(id):
            ...
    """
    
    def __init__(self, alias: str = "default"):
        self.alias = alias
        self.cache = cache
    
    def get(self, key: str, default: Any = None) -> Any:
        """Obtém valor do cache."""
        return self.cache.get(key, default, cache_alias=self.alias)
    
    def set(self, key: str, value: Any, timeout: int = 300) -> None:
        """Define valor no cache."""
        self.cache.set(key, value, timeout, cache_alias=self.alias)
    
    def delete(self, key: str) -> None:
        """Remove key do cache."""
        self.cache.delete(key, cache_alias=self.alias)
    
    def delete_pattern(self, pattern: str) -> None:
        """Remove todas as keys que matching o pattern.
        
        Nota: Suporta apenas Redis com padrão simple.
        """
        try:
            from django_redis import get_redis_connection
            redis_conn = get_redis_connection(self.alias)
            keys = redis_conn.keys(pattern)
            if keys:
                redis_conn.delete(*keys)
        except Exception:
            pass
    
    def get_or_set(self, key: str, callable_fn: Callable, timeout: int = 300) -> Any:
        """Get value from cache or set it using callable."""
        value = self.get(key)
        if value is None:
            value = callable_fn()
            self.set(key, value, timeout)
        return value
    
    def cached(self, key_template: str, timeout: int = 300):
        """Decorator para cachear resultado de função."""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                key = key_template.format(*args, **kwargs)
                value = self.get(key)
                if value is None:
                    value = func(*args, **kwargs)
                    self.set(key, value, timeout)
                return value
            return wrapper
        return decorator
    
    @staticmethod
    def invalidate_model_cache(model_name: str, instance_id: str = None):
        """Invalidate cache for a model.
        
        Usage:
            CacheService.invalidate_model_cache("Post", "123")
            CacheService.invalidate_model_cache("Post")  # All posts
        """
        service = CacheService()
        if instance_id:
            service.delete(f"{model_name}:{instance_id}")
        else:
            service.delete_pattern(f"{model_name}:*")


class CacheMixin:
    """Mixin para ViewSets que desejam cachear suas respostas.
    
    Uso:
        class PostViewSet(CacheMixin, ModelViewSet):
            cache_prefix = "blog:posts"
            cache_timeout = 60
            
            def list(self, request):
                # Cache mixin automatically caches list response
                return super().list(request)
    """
    
    cache_prefix = ""
    cache_timeout = 60
    
    def get_cache_key(self, action: str = "list") -> str:
        """Gera key de cache baseado na action."""
        page = self.paginator.page if hasattr(self, 'paginator') and self.paginator else None
        page_num = page.number if page else 0
        return f"{self.cache_prefix}:{action}:page:{page_num}"
    
    def list(self, request, *args, **kwargs):
        """Override list para usar cache."""
        service = CacheService()
        cache_key = self.get_cache_key("list")
        
        response = service.get(cache_key)
        if response is not None:
            return response
        
        response = super().list(request, *args, **kwargs)
        service.set(cache_key, response, self.cache_timeout)
        return response
    
    def retrieve(self, request, *args, **kwargs):
        """Override retrieve para usar cache."""
        service = CacheService()
        pk = kwargs.get('pk', '')
        cache_key = f"{self.cache_prefix}:detail:{pk}"
        
        response = service.get(cache_key)
        if response is not None:
            return response
        
        response = super().retrieve(request, *args, **kwargs)
        service.set(cache_key, response, self.cache_timeout)
        return response
    
    def get_queryset(self):
        """Invalidate cache quando queryset muda."""
        return super().get_queryset()
    
    def perform_create(self, serializer):
        """Invalidate list cache on create."""
        service = CacheService()
        service.delete_pattern(f"{self.cache_prefix}:list:*")
        return super().perform_create(serializer)
    
    def perform_update(self, serializer):
        """Invalidate detail cache on update."""
        service = CacheService()
        service.delete_pattern(f"{self.cache_prefix}:list:*")
        service.delete_pattern(f"{self.cache_prefix}:detail:*")
        return super().perform_update(serializer)
    
    def perform_destroy(self, instance):
        """Invalidate caches on delete."""
        service = CacheService()
        service.delete_pattern(f"{self.cache_prefix}:list:*")
        service.delete_pattern(f"{self.cache_prefix}:detail:*")
        return super().perform_destroy(instance)
