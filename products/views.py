from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from .models import Product
from .serializers import ProductSerializer, AdminProductSerializer

class CanManageProducts(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed = ['BUSINESS_OWNER', 'RESTAURANT_OWNER', 'HOTEL_OWNER', 'MERCHANT', 'FARMER', 'SUPER_ADMIN']
        return request.user.role in allowed

class ProductListView(generics.ListAPIView):
    """
    Liste de tous les produits actifs (Public)
    """
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

class MyBusinessProductListView(generics.ListCreateAPIView):
    """
    Gérer les produits de son entreprise.
    """
    serializer_class = ProductSerializer
    permission_classes = [CanManageProducts]

    def get_queryset(self):
        # Retourne uniquement les produits des entreprises qui appartiennent à l'utilisateur
        return Product.objects.filter(business__owner=self.request.user)

    def perform_create(self, serializer):
        business = serializer.validated_data.get('business')
        if business.owner == self.request.user:
            serializer.save()
        else:
            raise PermissionDenied("Vous n'êtes pas le propriétaire de cette entreprise.")

class AdminProductListView(generics.ListAPIView):
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = AdminProductSerializer
    permission_classes = [permissions.AllowAny] # Use AllowAny temporarily for testing
