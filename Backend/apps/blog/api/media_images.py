from rest_framework import viewsets, parsers

from apps.media.models import MediaFile
from apps.media.serializers import MediaFileSerializer
from apps.blog.permissions.blog_permissions import IsBlogEditorOrReadOnly


class MediaImageViewSet(viewsets.ModelViewSet):
    """
    Endpoint de imagens do blog. Delega para apps/media/MediaFile.
    Rota: /api/v1/blog/media/images/
    Aceita upload multipart (POST) e listagem (GET).
    Exclusão via apps/media/ diretamente.
    """

    permission_classes = [IsBlogEditorOrReadOnly]
    serializer_class = MediaFileSerializer
    queryset = MediaFile.objects.select_related("uploaded_by").all()
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]
    http_method_names = ["get", "post", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
