from django.urls import path
from .views import ServiceListView, MyServiceListView, AdminServiceListView

urlpatterns = [
    path('', ServiceListView.as_view(), name='service-list-public'),
    path('me/', MyServiceListView.as_view(), name='my-service-list-create'),
    path('admin/list/', AdminServiceListView.as_view(), name='admin-service-list'),
]
