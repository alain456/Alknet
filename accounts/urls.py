from django.urls import path
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, ProfileView, AdminUserListView, AdminProfessionalListView,
    CustomTokenObtainPairView,     AdminUserCreateView, AdminUserDetailView, AdminAuditLogListView,
    AdminPlatformRoleListView, AdminPlatformRoleDetailView,
    AdminPlatformActorListCreateView, AdminPlatformActorDetailView,
    VerifyEmailView, ResendVerificationEmailView,
    PasswordResetRequestView, PasswordResetConfirmView,
    OAuthProvidersStatusView, OAuthStartView, OAuthCallbackView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('resend-verification/', ResendVerificationEmailView.as_view(), name='resend_verification'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('oauth/providers/', OAuthProvidersStatusView.as_view(), name='oauth_providers'),
    path('oauth/<str:provider>/start/', OAuthStartView.as_view(), name='oauth_start'),
    path('oauth/<str:provider>/callback/', OAuthCallbackView.as_view(), name='oauth_callback'),
    path('admin/users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/create/', AdminUserCreateView.as_view(), name='admin_user_create'),
    path('admin/users/<uuid:pk>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/professionals/', AdminProfessionalListView.as_view(), name='admin_professional_list'),
    path('admin/audit-logs/', AdminAuditLogListView.as_view(), name='admin_audit_logs'),
    path('admin/platform-roles/', AdminPlatformRoleListView.as_view(), name='admin_platform_roles'),
    path('admin/platform-roles/<slug:code>/', AdminPlatformRoleDetailView.as_view(), name='admin_platform_role_detail'),
    path('admin/platform-actors/', AdminPlatformActorListCreateView.as_view(), name='admin_platform_actors'),
    path('admin/platform-actors/<uuid:pk>/', AdminPlatformActorDetailView.as_view(), name='admin_platform_actor_detail'),
]

