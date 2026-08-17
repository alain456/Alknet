from django.urls import path
from .views import (
    LocationTreeAPIView,
    ProvinceListCreateView, ProvinceDetailView,
    CommuneListCreateView, CommuneDetailView,
    ZoneListCreateView, ZoneDetailView,
    QuartierListCreateView, QuartierDetailView,
    AvenueListCreateView, AvenueDetailView,
    SeedLocationsAPIView
)

urlpatterns = [
    path('tree/', LocationTreeAPIView.as_view(), name='location-tree'),
    path('seed/', SeedLocationsAPIView.as_view(), name='location-seed'),
    
    path('provinces/', ProvinceListCreateView.as_view(), name='province-list'),
    path('provinces/<uuid:pk>/', ProvinceDetailView.as_view(), name='province-detail'),
    
    path('communes/', CommuneListCreateView.as_view(), name='commune-list'),
    path('communes/<uuid:pk>/', CommuneDetailView.as_view(), name='commune-detail'),
    
    path('zones/', ZoneListCreateView.as_view(), name='zone-list'),
    path('zones/<uuid:pk>/', ZoneDetailView.as_view(), name='zone-detail'),

    path('quartiers/', QuartierListCreateView.as_view(), name='quartier-list'),
    path('quartiers/<uuid:pk>/', QuartierDetailView.as_view(), name='quartier-detail'),

    path('avenues/', AvenueListCreateView.as_view(), name='avenue-list'),
    path('avenues/<uuid:pk>/', AvenueDetailView.as_view(), name='avenue-detail'),
]
