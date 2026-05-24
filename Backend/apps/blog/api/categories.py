from rest_framework import viewsets, permissions
from ..models import Category
from ..serializers.category import CategorySerializer
from ..permissions.blog_permissions import IsBlogEditorOrReadOnly

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsBlogEditorOrReadOnly]


class PublicCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"
