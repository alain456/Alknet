from django.urls import path
from .views import (
    BusinessListView, MyBusinessListView, AdminBusinessListView, AdminBusinessDetailView, 
    BusinessEmployeeListCreateView, AdminModerationListView, AdminModerationApproveView, 
    AdminModerationRejectView, AdminCSVImportView
)

urlpatterns = [
    path('', BusinessListView.as_view(), name='business-list-public'),
    path('me/', MyBusinessListView.as_view(), name='my-business-list-create'),
    path('my-business/employees/', BusinessEmployeeListCreateView.as_view(), name='my-business-employees'),
    path('admin/list/', AdminBusinessListView.as_view(), name='admin_business_list'),
    path('admin/<uuid:pk>/', AdminBusinessDetailView.as_view(), name='admin_business_detail'),
    path('admin/moderation/', AdminModerationListView.as_view(), name='admin_moderation_list'),
    path('admin/moderation/<uuid:pk>/approve/', AdminModerationApproveView.as_view(), name='admin_moderation_approve'),
    path('admin/moderation/<uuid:pk>/reject/', AdminModerationRejectView.as_view(), name='admin_moderation_reject'),
    path('admin/import-csv/', AdminCSVImportView.as_view(), name='admin_import_csv'),
]
