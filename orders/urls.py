from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, CartAPIView, CheckoutAPIView, CommerceDashboardAPIView, CommerceShopStatusAPIView

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='order')

urlpatterns = [
    path('commerce/dashboard/', CommerceDashboardAPIView.as_view(), name='commerce-dashboard'),
    path('commerce/shop-status/', CommerceShopStatusAPIView.as_view(), name='commerce-shop-status'),
    path('commerce/<uuid:business_id>/cart/', CartAPIView.as_view(), name='commerce-cart'),
    path('commerce/<uuid:business_id>/checkout/', CheckoutAPIView.as_view(), name='commerce-checkout'),
    path('', include(router.urls)),
]
