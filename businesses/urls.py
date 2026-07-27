from django.urls import path
from .views import BusinessListView, MyBusinessListView

urlpatterns = [
    path('', BusinessListView.as_view(), name='business-list-public'),
    path('me/', MyBusinessListView.as_view(), name='my-business-list-create'),
]
