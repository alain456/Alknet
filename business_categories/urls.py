from django.urls import path
from .views import BusinessCategoryListView, BusinessCategoryCreateView

urlpatterns = [
    path('', BusinessCategoryListView.as_view(), name='category-list'),
    path('create/', BusinessCategoryCreateView.as_view(), name='category-create'),
]
