from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import BusinessCategory
from .serializers import BusinessCategorySerializer
from permissions.api_permissions import IsSuperAdmin

class BusinessCategoryListView(generics.ListAPIView):
    queryset = BusinessCategory.objects.all()
    serializer_class = BusinessCategorySerializer
    permission_classes = [AllowAny]

class BusinessCategoryCreateView(generics.CreateAPIView):
    queryset = BusinessCategory.objects.all()
    serializer_class = BusinessCategorySerializer
    permission_classes = [IsSuperAdmin]
