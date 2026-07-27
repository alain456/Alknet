from django.urls import path
from .views import ServiceCategoryListView, ServiceCategoryCreateView

urlpatterns = [
    path('', ServiceCategoryListView.as_view(), name='service-category-list'),
    path('create/', ServiceCategoryCreateView.as_view(), name='service-category-create'),
]
