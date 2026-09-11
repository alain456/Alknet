from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from permissions.custom_permissions import IsSuperAdmin
from .models import Service
from .serializers import ServiceSerializer, AdminServiceSerializer


class CanCreateService(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed = ['BUSINESS_OWNER', 'PROFESSIONAL']
        return request.user.role in allowed


class ServiceListView(generics.ListAPIView):
    """Liste de tous les services actifs (Public)"""
    queryset = Service.objects.filter(status='ACTIVE').select_related(
        'category', 'business', 'professional'
    ).order_by('-created_at')
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]


class MyServiceListView(generics.ListCreateAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [CanCreateService]

    def get_queryset(self):
        return Service.objects.filter(professional=self.request.user) | Service.objects.filter(
            business__owner=self.request.user
        )

    def perform_create(self, serializer):
        business = serializer.validated_data.get('business')
        if not business:
            serializer.save(professional=self.request.user)
        else:
            if business.owner == self.request.user:
                serializer.save()
            else:
                raise PermissionDenied("Vous n'êtes pas le propriétaire de cette entreprise.")


class AdminServiceListView(generics.ListAPIView):
    queryset = Service.objects.all().select_related(
        'category', 'business', 'professional'
    ).order_by('-created_at')
    serializer_class = AdminServiceSerializer
    permission_classes = [IsSuperAdmin]


class AdminServiceDetailView(generics.RetrieveUpdateAPIView):
    queryset = Service.objects.all().select_related(
        'category', 'business', 'professional'
    )
    serializer_class = AdminServiceSerializer
    permission_classes = [IsSuperAdmin]


class AdminServiceStatusView(APIView):
    """POST { status: ACTIVE|SUSPENDED|DRAFT }"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        service = Service.objects.filter(pk=pk).first()
        if not service:
            return Response({'error': 'Service introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        new_status = (request.data.get('status') or '').strip().upper()
        if new_status not in dict(Service.STATUS_CHOICES):
            return Response({'error': 'Statut invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        service.status = new_status
        service.save(update_fields=['status', 'updated_at'])
        return Response(AdminServiceSerializer(service).data)
