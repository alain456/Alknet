from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from .models import Service
from .serializers import ServiceSerializer

class CanCreateService(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed = ['BUSINESS_OWNER', 'PROFESSIONAL', 'SUPER_ADMIN']
        return request.user.role in allowed

class ServiceListView(generics.ListAPIView):
    """
    Liste de tous les services actifs (Public)
    """
    queryset = Service.objects.filter(status='ACTIVE')
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]

class MyServiceListView(generics.ListCreateAPIView):
    """
    Gérer ses propres services.
    Si lié à un Business, l'utilisateur doit être le propriétaire du Business.
    Sinon, le service est lié directement à l'utilisateur.
    """
    serializer_class = ServiceSerializer
    permission_classes = [CanCreateService]

    def get_queryset(self):
        # Retourner les services liés directement au professionnel OU liés à ses entreprises
        return Service.objects.filter(professional=self.request.user) | Service.objects.filter(business__owner=self.request.user)

    def perform_create(self, serializer):
        business = serializer.validated_data.get('business')
        if not business:
            serializer.save(professional=self.request.user)
        else:
            if business.owner == self.request.user:
                serializer.save()
            else:
                raise PermissionDenied("Vous n'êtes pas le propriétaire de cette entreprise.")

from .serializers import AdminServiceSerializer

class AdminServiceListView(generics.ListAPIView):
    queryset = Service.objects.all().order_by('-created_at')
    serializer_class = AdminServiceSerializer
    permission_classes = [permissions.AllowAny]

