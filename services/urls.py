from django.urls import path
from .views import ServiceListView, MyServiceListView

urlpatterns = [
    path('', ServiceListView.as_view(), name='service-list-public'),
    path('me/', MyServiceListView.as_view(), name='my-service-list-create'),
]
