from django.urls import path
from .views import (
    BusinessListView, BusinessDetailView, MyBusinessListView, AdminBusinessListView, AdminBusinessDetailView, 
    BusinessEmployeeListCreateView, BusinessEmployeeDetailView, AdminModerationListView, AdminModerationApproveView, 
    AdminModerationRejectView, AdminCSVImportView, PublicBusinessRegistrationView,
    BusinessRoleListCreateView, BusinessRoleDetailView
)

urlpatterns = [
    path('register/', PublicBusinessRegistrationView.as_view(), name='business-register-public'),
    path('', BusinessListView.as_view(), name='business-list-public'),
    path('<uuid:pk>/', BusinessDetailView.as_view(), name='business-detail-public'),
    path('me/', MyBusinessListView.as_view(), name='my-business-list-create'),
    path('my-business/roles/', BusinessRoleListCreateView.as_view(), name='my-business-roles'),
    path('my-business/roles/<uuid:pk>/', BusinessRoleDetailView.as_view(), name='my-business-roles-detail'),
    path('my-business/employees/', BusinessEmployeeListCreateView.as_view(), name='my-business-employees'),
    path('my-business/employees/<uuid:pk>/', BusinessEmployeeDetailView.as_view(), name='my-business-employee-detail'),
    path('admin/list/', AdminBusinessListView.as_view(), name='admin_business_list'),
    path('admin/<uuid:pk>/', AdminBusinessDetailView.as_view(), name='admin_business_detail'),
    path('admin/moderation/', AdminModerationListView.as_view(), name='admin_moderation_list'),
    path('admin/moderation/<uuid:pk>/approve/', AdminModerationApproveView.as_view(), name='admin_moderation_approve'),
    path('admin/moderation/<uuid:pk>/reject/', AdminModerationRejectView.as_view(), name='admin_moderation_reject'),
    path('admin/import-csv/', AdminCSVImportView.as_view(), name='admin_import_csv'),
]
