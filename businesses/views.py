from rest_framework import generics
from rest_framework.permissions import AllowAny, BasePermission
from .models import Business
from .serializers import BusinessSerializer

class CanCreateBusiness(BasePermission):
    """
    Vérifie si l'utilisateur a un rôle lui permettant de créer une entreprise.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed_roles = ['BUSINESS_OWNER', 'RESTAURANT_OWNER', 'HOTEL_OWNER', 'MERCHANT', 'FARMER', 'SUPER_ADMIN']
        return request.user.role in allowed_roles

class BusinessListView(generics.ListAPIView):
    """
    Endpoint public pour lister toutes les entreprises validées et actives.
    """
    queryset = Business.objects.filter(is_active=True, is_verified=True)
    serializer_class = BusinessSerializer
    permission_classes = [AllowAny]

class MyBusinessListView(generics.ListCreateAPIView):
    """
    Endpoint pour qu'un utilisateur puisse lister ses entreprises et en créer de nouvelles.
    """
    serializer_class = BusinessSerializer
    permission_classes = [CanCreateBusiness]

    def get_queryset(self):
        return Business.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # Assigne automatiquement l'utilisateur connecté comme propriétaire
        serializer.save(owner=self.request.user)
