from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import ProductCategory
from .serializers import ProductCategorySerializer
from permissions.custom_permissions import PlatformMethodPermission

class ProductCategoryListView(generics.ListAPIView):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [AllowAny]

class ProductCategoryCreateView(generics.CreateAPIView):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'POST': 'platform.catalog.update'}
