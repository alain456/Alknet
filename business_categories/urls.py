from django.urls import path
from .views import BusinessCategoryListView, BusinessCategoryCreateView, BusinessCategoryDetailView

urlpatterns = [
    path('', BusinessCategoryListView.as_view(), name='category-list'),
    path('create/', BusinessCategoryCreateView.as_view(), name='category-create'),
    path('<uuid:pk>/', BusinessCategoryDetailView.as_view(), name='category-detail'),
]
