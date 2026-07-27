from django.urls import path
from .views import BusinessListView, MyBusinessListView, AdminBusinessListView, BusinessEmployeeListCreateView

urlpatterns = [
    path('', BusinessListView.as_view(), name='business-list-public'),
    path('me/', MyBusinessListView.as_view(), name='my-business-list-create'),
    path('my-business/employees/', BusinessEmployeeListCreateView.as_view(), name='my-business-employees'),
    path('admin/list/', AdminBusinessListView.as_view(), name='admin_business_list'),
]
