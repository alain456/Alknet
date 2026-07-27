from rest_framework import generics
from rest_framework.permissions import AllowAny, BasePermission
from .models import Business
from .serializers import BusinessSerializer, AdminBusinessSerializer

class CanCreateBusiness(BasePermission):
    """
    Vérifie si l'utilisateur a un rôle lui permettant de créer une entreprise.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed_roles = ['BUSINESS_OWNER', 'SUPER_ADMIN']
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

class AdminBusinessListView(generics.ListAPIView):
    queryset = Business.objects.all().order_by('-created_at')
    serializer_class = AdminBusinessSerializer
    permission_classes = [AllowAny] # Use AllowAny temporarily for testing

from .models import BusinessEmployee
from .serializers import BusinessEmployeeSerializer

class BusinessEmployeeListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessEmployeeSerializer
    permission_classes = [AllowAny] # Use AllowAny temporarily for testing

    def get_queryset(self):
        # Pour simplifier, on prend le premier business de l'utilisateur. En production, on passerait le business_id dans l'URL.
        business = self.request.user.businesses.first()
        if business:
            return BusinessEmployee.objects.filter(business=business).order_by('-created_at')
        return BusinessEmployee.objects.none()

    def perform_create(self, serializer):
        business = self.request.user.businesses.first()
        if business:
            serializer.save(business=business)
