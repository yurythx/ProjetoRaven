from django.urls import path
from .search import GlobalSearchView

urlpatterns = [
    path("", GlobalSearchView.as_view(), name="global_search"),
]
