from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductListView, MyBusinessProductListView, MyBusinessProductDetailView,
    AdminProductListView, ProductVariantViewSet, ShopCategoryViewSet,
    PublicShopCategoryListView, StockMovementListCreateView,
)

router = DefaultRouter()
router.register(r'variants', ProductVariantViewSet, basename='product-variant')
router.register(r'shop-categories', ShopCategoryViewSet, basename='shop-category')

urlpatterns = [
    path('', ProductListView.as_view(), name='product-list-public'),
    path('my-business/', MyBusinessProductListView.as_view(), name='my-business-product-list-create'),
    path('my-business/<uuid:pk>/', MyBusinessProductDetailView.as_view(), name='my-business-product-detail'),
    path('shop-categories/public/', PublicShopCategoryListView.as_view(), name='shop-category-public'),
    path('stock-movements/', StockMovementListCreateView.as_view(), name='stock-movements'),
    path('admin/list/', AdminProductListView.as_view(), name='admin-product-list'),
    path('', include(router.urls)),
]
