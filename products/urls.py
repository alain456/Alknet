from django.urls import path
from .views import ProductListView, MyBusinessProductListView

urlpatterns = [
    path('', ProductListView.as_view(), name='product-list-public'),
    path('my-business/', MyBusinessProductListView.as_view(), name='my-business-product-list-create'),
]
