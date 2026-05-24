from rest_framework import viewsets, permissions
from ..models import Tag
from ..serializers.tag import TagSerializer
from ..permissions.blog_permissions import IsBlogEditorOrReadOnly

class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [IsBlogEditorOrReadOnly]


class PublicTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"
