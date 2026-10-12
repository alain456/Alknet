from django.urls import path
from .views import (
    ServiceListView,
    MyServiceListView,
    AdminServiceListView,
    AdminServiceDetailView,
    AdminServiceStatusView,
    ServiceReviewView,
    MyServiceReviewsView,
)

urlpatterns = [
    path('', ServiceListView.as_view(), name='service-list-public'),
    path('me/', MyServiceListView.as_view(), name='my-service-list-create'),
    path('reviews/mine/', MyServiceReviewsView.as_view(), name='my-service-reviews'),
    path('<uuid:pk>/reviews/', ServiceReviewView.as_view(), name='service-review'),
    path('admin/list/', AdminServiceListView.as_view(), name='admin-service-list'),
    path('admin/<uuid:pk>/', AdminServiceDetailView.as_view(), name='admin-service-detail'),
    path('admin/<uuid:pk>/status/', AdminServiceStatusView.as_view(), name='admin-service-status'),
]
