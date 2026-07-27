from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import ServiceCategory
from .serializers import ServiceCategorySerializer
from permissions.api_permissions import IsSuperAdmin

class ServiceCategoryListView(generics.ListAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [AllowAny]

class ServiceCategoryCreateView(generics.CreateAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsSuperAdmin]
