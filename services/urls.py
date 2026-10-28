from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .provider_views import (
    ClientRequestViewSet,
    MerchantDocumentViewSet,
    MerchantInboxViewSet,
    MerchantOfferViewSet,
    MerchantProfileView,
    MerchantTeamViewSet,
    PublicOfferContactView,
    PublicOfferDetailView,
    PublicProviderContactView,
    PublicProviderDetailView,
    PublicProviderListView,
    PublicRequestFollowView,
    PublicRequestMessageView,
    merchant_dashboard,
)
from .views import (
    ServiceListView,
    MyServiceListView,
    AdminServiceListView,
    AdminServiceDetailView,
    AdminServiceStatusView,
    ServiceReviewView,
    MyServiceReviewsView,
)

router = DefaultRouter()
router.register('me/offers', MerchantOfferViewSet, basename='service-me-offers')
router.register('me/team', MerchantTeamViewSet, basename='service-me-team')
router.register('me/documents', MerchantDocumentViewSet, basename='service-me-documents')
router.register('me/inbox', MerchantInboxViewSet, basename='service-me-inbox')
router.register('me/requests', ClientRequestViewSet, basename='service-me-requests')

urlpatterns = [
    path('providers/', PublicProviderListView.as_view(), name='service-providers'),
    path('providers/<uuid:pk>/', PublicProviderDetailView.as_view(), name='service-provider-detail'),
    path('providers/<uuid:pk>/contact/', PublicProviderContactView.as_view(), name='service-provider-contact'),
    path('offers/<uuid:pk>/', PublicOfferDetailView.as_view(), name='service-offer-detail'),
    path('offers/<uuid:pk>/contact/', PublicOfferContactView.as_view(), name='service-offer-contact'),
    path('requests/<str:token>/', PublicRequestFollowView.as_view(), name='service-request-follow'),
    path('requests/<str:token>/messages/', PublicRequestMessageView.as_view(), name='service-request-message'),
    path('me/profile/', MerchantProfileView.as_view(), name='service-me-profile'),
    path('me/dashboard/', merchant_dashboard, name='service-me-dashboard'),
    path('', include(router.urls)),
    path('', ServiceListView.as_view(), name='service-list-public'),
    path('me/', MyServiceListView.as_view(), name='my-service-list-create'),
    path('reviews/mine/', MyServiceReviewsView.as_view(), name='my-service-reviews'),
    path('<uuid:pk>/reviews/', ServiceReviewView.as_view(), name='service-review'),
    path('admin/list/', AdminServiceListView.as_view(), name='admin-service-list'),
    path('admin/<uuid:pk>/', AdminServiceDetailView.as_view(), name='admin-service-detail'),
    path('admin/<uuid:pk>/status/', AdminServiceStatusView.as_view(), name='admin-service-status'),
]
