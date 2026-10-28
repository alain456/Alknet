from django.urls import path
from .views import AdminDashboardStatsView, AdminSearchView, DataGovernanceView

urlpatterns = [
    path('dashboard-stats/', AdminDashboardStatsView.as_view(), name='dashboard_stats'),
    path('admin-search/', AdminSearchView.as_view(), name='admin_search'),
    path('governance/', DataGovernanceView.as_view(), name='data_governance'),
]
