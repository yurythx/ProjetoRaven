from rest_framework import permissions

class IsBlogEditor(permissions.BasePermission):
    """
    Permite acesso apenas a editores de blog, staff ou superusers.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        return bool(
            getattr(user, "is_blog_editor", False)
            or user.is_staff
            or user.is_superuser
        )

class IsBlogEditorOrReadOnly(permissions.BasePermission):
    """
    Permite leitura para todos, mas escrita apenas para editores de blog.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
            
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        return bool(
            getattr(user, "is_blog_editor", False)
            or user.is_staff
            or user.is_superuser
        )

class IsAuthorOrEditor(permissions.BasePermission):
    """
    Permite acesso apenas ao autor do objeto ou a um editor de blog.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        # Editores tem acesso total
        if bool(getattr(user, "is_blog_editor", False) or user.is_staff or user.is_superuser):
            return True
            
        # Verifica se o objeto tem um atributo 'author' ou 'user'
        author = getattr(obj, "author", getattr(obj, "user", None))
        return author == user
