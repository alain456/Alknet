from django.urls import path
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, ProfileView, AdminUserListView, AdminProfessionalListView, CustomTokenObtainPairView, AdminUserCreateView, AdminUserDetailView, AdminAuditLogListView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('admin/users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/create/', AdminUserCreateView.as_view(), name='admin_user_create'),
    path('admin/users/<uuid:pk>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/professionals/', AdminProfessionalListView.as_view(), name='admin_professional_list'),
    path('admin/audit-logs/', AdminAuditLogListView.as_view(), name='admin_audit_logs'),
]

