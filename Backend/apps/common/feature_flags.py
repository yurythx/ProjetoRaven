"""
Sistema de Feature Flags para controle de funcionalidades.

Uso:
    from apps.common.feature_flags import is_enabled, flag
    
    # Decorator
    @flag("new_quest_system")
    def new_quest_functionality():
        ...
    
    # Context manager
    with flag("beta_feature"):
        # Feature ativa
        ...
    
    # Direct check
    if is_enabled("new_ui", user):
        return new_ui_view()
    return old_ui_view()
"""
from functools import wraps
from typing import Callable, Optional
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()


class FeatureFlagRegistry:
    """Registry central de feature flags.
    
    Flags podem ser definidas via settings ou como percentage rollouts.
    """
    
    def __init__(self):
        self._flags = {}
    
    def register(self, name: str, default: bool = False, description: str = ""):
        """Registra uma nova feature flag."""
        self._flags[name] = {
            "default": default,
            "description": description,
            "enabled": default,
        }
    
    def enable(self, name: str):
        """Habilita uma flag manualmente."""
        if name in self._flags:
            self._flags[name]["enabled"] = True
    
    def disable(self, name: str):
        """Desabilita uma flag manualmente."""
        if name in self._flags:
            self._flags[name]["enabled"] = False
    
    def get(self, name: str, default: bool = False) -> bool:
        """Retorna status de uma flag."""
        if name in self._flags:
            return self._flags[name]["enabled"]
        
        env_key = f"FLAG_{name.upper()}"
        env_value = getattr(settings, env_key, None)
        if env_value is not None:
            return env_value
        
        return default


flags = FeatureFlagRegistry()

flags.register("new_quest_system", default=False, description="Novo sistema de missões")
flags.register("pvp_enabled", default=True, description="Combate PvP habilitado")
flags.register("trading_enabled", default=True, description="Sistema de trading habilitado")
flags.register("guild_system", default=False, description="Sistema de guildas")
flags.register("seasonal_events", default=False, description="Eventos sazonais")
flags.register("battle_pass", default=False, description="Battle Pass season")
flags.register("ranked_matches", default=False, description="Partidas ranqueadas")


def is_enabled(flag_name: str, user = None, default: bool = False) -> bool:
    """Verifica se uma feature flag está habilitada.
    
    Args:
        flag_name: Nome da flag
        user: Usuário para verificar permissões específicas
        default: Valor padrão se flag não existir
    
    Returns:
        True se flag está habilitada
    """
    enabled = flags.get(flag_name, default)
    
    if not enabled:
        return False
    
    if user is None:
        return enabled
    
    user_flags_key = f"user_flags_{flag_name}"
    user_specific = getattr(user, user_flags_key, None)
    if user_specific is not None:
        return user_specific
    
    if hasattr(user, "is_admin") and user.is_admin:
        return True
    
    if hasattr(user, "is_staff") and user.is_staff:
        return True
    
    return enabled


def flag(flag_name: str):
    """Decorator para habilitar/desabilitar funções baseado em feature flags.
    
    Uso:
        @flag("beta_feature")
        def new_feature():
            return "Nova funcionalidade"
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if is_enabled(flag_name):
                return func(*args, **kwargs)
            return None
        return wrapper
    return decorator


class flag:
    """Context manager para feature flags.
    
    Uso:
        with flag("beta_feature"):
            # Feature ativa aqui
            ...
    """
    
    def __init__(self, flag_name: str, user = None):
        self.flag_name = flag_name
        self.user = user
        self.was_enabled = False
    
    def __enter__(self):
        self.was_enabled = is_enabled(self.flag_name, self.user)
        return self.was_enabled
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class FeatureFlagMiddleware:
    """Middleware para adicionar flags ao contexto de todas as requisições.
    
    Adiciona request.feature_flags com dicionário de todas as flags.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        request.feature_flags = {
            name: is_enabled(name, request.user)
            for name in flags._flags.keys()
        }
        
        return self.get_response(request)
