from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import ServiceCategory
from .serializers import ServiceCategorySerializer
from permissions.custom_permissions import PlatformMethodPermission

class ServiceCategoryListView(generics.ListAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [AllowAny]

class ServiceCategoryCreateView(generics.CreateAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'POST': 'platform.catalog.update'}
