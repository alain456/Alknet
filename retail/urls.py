from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PrescriptionViewSet,
    RetailCartViewSet,
    RetailOrderViewSet,
    RetailProductViewSet,
    RetailProfileViewSet,
    StockMovementViewSet,
    guest_checkout,
    list_proformas,
    list_retail_pharmacies,
    retail_dashboard,
    retail_patients,
)


router = DefaultRouter()
router.register(r'profile', RetailProfileViewSet, basename='retail-profile')
router.register(r'products', RetailProductViewSet, basename='retail-products')
router.register(r'stock-movements', StockMovementViewSet, basename='retail-stock')
router.register(r'orders', RetailOrderViewSet, basename='retail-orders')
router.register(r'cart', RetailCartViewSet, basename='retail-cart')
router.register(r'prescriptions', PrescriptionViewSet, basename='retail-prescriptions')

urlpatterns = [
    path('dashboard/', retail_dashboard, name='retail-dashboard'),
    path('patients/', retail_patients, name='retail-patients'),
    path('pharmacies/', list_retail_pharmacies, name='retail-pharmacies'),
    path('proformas/', list_proformas, name='retail-proformas'),
    path('guest-checkout/', guest_checkout, name='retail-guest-checkout'),
    path('', include(router.urls)),
]
