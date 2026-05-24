from rest_framework.versioning import URLPathVersioning
from rest_framework.exceptions import NotFound


class APIRouter:
    """URL Router com suporte a versionamento de API.
    
    Uso:
        urlpatterns = APIRouter(prefix='v1', app_name='api').urls
    """
    
    def __init__(self, prefix: str, app_name: str = None):
        self.prefix = prefix
        self.app_name = app_name
        self._urlpatterns = []
    
    @property
    def urls(self):
        return self._urlpatterns
    
    def register(self, path: str, viewset_or_view, basename: str = None):
        from django.urls import path as django_path, include
        from rest_framework.routers import DefaultRouter
        
        if hasattr(viewset_or_view, 'get_queryset'):
            router = DefaultRouter()
            router.register(path, viewset_or_view, basename=basename)
            self._urlpatterns.append(django_path(
                f'{self.prefix}/{path}/',
                include((router.urls, self.app_name or ''))
            ))
        else:
            self._urlpatterns.append(django_path(
                f'{self.prefix}/{path}/',
                viewset_or_view.as_view(),
                name=basename
            ))
        
        return self


class VersionedAPIVersioning(URLPathVersioning):
    """Versionamento de API via URL path.
    
    Suporta:
        /api/v1/...
        /api/v2/...
    
    O header Accept também pode ser usado:
        Accept: application/json; version=2
    """
    
    default_version = 'v1'
    allowed_versions = ['v1', 'v2']
    version_param = 'version'


def get_api_version(request) -> str:
    """Obtém a versão da API da requisição atual.
    
    Priority:
    1. Query param: ?version=v2
    2. URL path: /api/v2/
    3. Accept header: application/json; version=2
    4. Default: v1
    """
    versioning = VersionedAPIVersioning()
    try:
        version = versioning.determine_version(request)
        return version if version in versioning.allowed_versions else versioning.default_version
    except (ValueError, NotFound):
        return versioning.default_version


def deprecated_response(message: str = "This API version is deprecated."):
    """Resposta padrão para APIs deprecated."""
    from rest_framework.response import Response
    from rest_framework import status
    return Response(
        {
            "warning": message,
            "status": "deprecated"
        },
        status=status.HTTP_410_GONE,
        headers={"Deprecation": "true"}
    )
