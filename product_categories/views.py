from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import ProductCategory
from .serializers import ProductCategorySerializer
from permissions.api_permissions import IsSuperAdmin

class ProductCategoryListView(generics.ListAPIView):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [AllowAny]

class ProductCategoryCreateView(generics.CreateAPIView):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [IsSuperAdmin]
