from django.urls import path
from .views import AdminDashboardStatsView, DataGovernanceView

urlpatterns = [
    path('dashboard-stats/', AdminDashboardStatsView.as_view(), name='dashboard_stats'),
    path('governance/', DataGovernanceView.as_view(), name='data_governance'),
]
