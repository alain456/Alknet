from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from permissions.custom_permissions import PlatformMethodPermission
from .models import Service, ServiceReview, refresh_service_rating
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
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.catalog.view'}


class AdminServiceDetailView(generics.RetrieveUpdateAPIView):
    queryset = Service.objects.all().select_related(
        'category', 'business', 'professional'
    )
    serializer_class = AdminServiceSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': 'platform.catalog.view',
        'PUT': 'platform.catalog.update',
        'PATCH': 'platform.catalog.update',
    }


class AdminServiceStatusView(APIView):
    """POST { status: ACTIVE|SUSPENDED|DRAFT }"""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'POST': 'platform.catalog.update'}

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


class ServiceReviewView(APIView):
    """Note 1 à 5. Une seule par client ; une nouvelle note remplace la précédente."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        service = Service.objects.filter(pk=pk, status='ACTIVE').select_related('business').first()
        if not service:
            return Response({'error': 'Service introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        if service.professional_id == request.user.id:
            return Response({'error': 'Vous ne pouvez pas noter votre propre service.'}, status=400)
        if service.business_id and service.business.owner_id == request.user.id:
            return Response({'error': 'Vous ne pouvez pas noter le service de votre entreprise.'}, status=400)
        try:
            score = int(request.data.get('score'))
        except (TypeError, ValueError):
            return Response({'error': 'Choisissez une note de 1 à 5.'}, status=400)
        if score < 1 or score > 5:
            return Response({'error': 'Choisissez une note de 1 à 5.'}, status=400)
        comment = (request.data.get('comment') or '').strip()[:500]
        ServiceReview.objects.update_or_create(
            service=service,
            author=request.user,
            defaults={'score': score, 'comment': comment},
        )
        refresh_service_rating(service)
        return Response({
            'service_id': str(service.id),
            'score': score,
            'rating': float(service.rating),
            'reviews_count': service.reviews_count,
        })


class MyServiceReviewsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = ServiceReview.objects.filter(author=request.user).values('service_id', 'score')
        return Response({str(row['service_id']): row['score'] for row in rows})
