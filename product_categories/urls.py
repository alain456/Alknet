from django.urls import path
from .views import ProductCategoryListView, ProductCategoryCreateView

urlpatterns = [
    path('', ProductCategoryListView.as_view(), name='product-category-list'),
    path('create/', ProductCategoryCreateView.as_view(), name='product-category-create'),
]
