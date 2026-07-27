from django.urls import path
from .views import ProductListView, MyBusinessProductListView, AdminProductListView

urlpatterns = [
    path('', ProductListView.as_view(), name='product-list-public'),
    path('my-business/', MyBusinessProductListView.as_view(), name='my-business-product-list-create'),
    path('admin/list/', AdminProductListView.as_view(), name='admin-product-list'),
]
