from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WholesaleProfileViewSet, WholesaleProductViewSet, StockMovementViewSet,
    WholesaleOrderViewSet, WholesaleCartViewSet,
    wholesale_dashboard, wholesale_clients, wholesale_client_detail,
    list_wholesale_pharmacies, guest_checkout, list_proformas,
)

router = DefaultRouter()
router.register(r"profile", WholesaleProfileViewSet, basename="wholesale-profile")
router.register(r"products", WholesaleProductViewSet, basename="wholesale-products")
router.register(r"stock-movements", StockMovementViewSet, basename="wholesale-stock")
router.register(r"orders", WholesaleOrderViewSet, basename="wholesale-orders")
router.register(r"cart", WholesaleCartViewSet, basename="wholesale-cart")

urlpatterns = [
    path("dashboard/", wholesale_dashboard, name="wholesale-dashboard"),
    path("clients/", wholesale_clients, name="wholesale-clients"),
    path("clients/<path:client_key>/", wholesale_client_detail, name="wholesale-client-detail"),
    path("pharmacies/", list_wholesale_pharmacies, name="wholesale-pharmacies"),
    path("proformas/", list_proformas, name="wholesale-proformas"),
    path("guest-checkout/", guest_checkout, name="wholesale-guest-checkout"),
    path("", include(router.urls)),
]
