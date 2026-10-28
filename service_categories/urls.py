from django.urls import path

from .views import ServiceCategoryCreateView, ServiceCategoryDetailView, ServiceCategoryListCreateView

urlpatterns = [
    path('', ServiceCategoryListCreateView.as_view(), name='service-category-list'),
    path('create/', ServiceCategoryCreateView.as_view(), name='service-category-create'),
    path('<uuid:pk>/', ServiceCategoryDetailView.as_view(), name='service-category-detail'),
]
