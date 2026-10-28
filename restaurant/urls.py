from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'menu', views.MenuItemViewSet, basename='restaurant-menu')
router.register(r'bookings', views.TableBookingViewSet, basename='restaurant-bookings')

urlpatterns = [
    path('profile/me/', views.profile_me, name='restaurant-profile-me'),
    path('dashboard/', views.dashboard, name='restaurant-dashboard'),
    path('public/venues/', views.public_venues, name='restaurant-public-list'),
    path('public/venues/<uuid:venue_id>/', views.public_venue_detail, name='restaurant-public-detail'),
    path('public/venues/<uuid:venue_id>/book/', views.public_book, name='restaurant-public-book'),
    path('', include(router.urls)),
]
