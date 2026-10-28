from rest_framework import generics

from accounts.platform_access import user_has_platform_perm
from permissions.custom_permissions import PlatformMethodPermission

from .models import ServiceCategory
from .serializers import ServiceCategorySerializer


class IsPlatformCatalogWrite(PlatformMethodPermission):
    WRITE_PERMISSION = 'platform.catalog.update'

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user_has_platform_perm(user, self.WRITE_PERMISSION)


class ServiceCategoryListCreateView(generics.ListCreateAPIView):
    queryset = ServiceCategory.objects.all().order_by('name')
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsPlatformCatalogWrite]


class ServiceCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsPlatformCatalogWrite]


class ServiceCategoryCreateView(ServiceCategoryListCreateView):
    """Alias POST /create/ conservé."""
    http_method_names = ['post', 'head', 'options']
