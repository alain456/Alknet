from django.urls import path
from .views import AdminDashboardStatsView

urlpatterns = [
    path('dashboard-stats/', AdminDashboardStatsView.as_view(), name='dashboard_stats'),
]
