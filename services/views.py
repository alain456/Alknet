from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.services import log_audit_event
from permissions.custom_permissions import PlatformMethodPermission
from .models import Service, ServiceReview, refresh_service_rating
from .pagination import ServicesPageNumberPagination
from .permissions import services_tenant_business
from .serializers import ServiceSerializer, AdminServiceSerializer
from .throttling import ServicesPublicThrottle


class CanCreateService(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed = ['BUSINESS_OWNER', 'PROFESSIONAL']
        return request.user.role in allowed


class ServiceListView(generics.ListAPIView):
    """Liste de tous les services actifs (Public)"""
    queryset = Service.objects.filter(status='ACTIVE').select_related(
        'category', 'business', 'business__primary_category', 'professional', 'parent',
    ).order_by('-created_at')
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = ServicesPageNumberPagination


class MyServiceListView(generics.ListCreateAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [CanCreateService]
    pagination_class = ServicesPageNumberPagination

    def get_queryset(self):
        business = services_tenant_business(self.request.user)
        if business:
            return Service.objects.filter(business=business).select_related(
                'category', 'business', 'parent',
            )
        return Service.objects.filter(professional=self.request.user).select_related(
            'category', 'business', 'parent',
        )

    def perform_create(self, serializer):
        tenant = services_tenant_business(self.request.user)
        if tenant:
            serializer.save(business=tenant, professional=self.request.user)
            return
        business = serializer.validated_data.get('business')
        if business and business.owner != self.request.user:
            raise PermissionDenied("Vous n'êtes pas le propriétaire de cette entreprise.")
        serializer.save(professional=self.request.user)


class AdminServiceListView(generics.ListAPIView):
    serializer_class = AdminServiceSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.catalog.view'}
    pagination_class = ServicesPageNumberPagination

    def get_queryset(self):
        qs = Service.objects.filter(parent__isnull=True).select_related(
            'category', 'business', 'business__primary_category', 'professional', 'parent',
        ).prefetch_related('sub_items', 'grouped_services').order_by('-created_at')
        search = (self.request.query_params.get('q') or '').strip()
        status_filter = (self.request.query_params.get('status') or '').strip().upper()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(business__name__icontains=search)
                | Q(sub_items__title__icontains=search)
                | Q(grouped_services__title__icontains=search)
            ).distinct()
        if status_filter:
            qs = qs.filter(status=status_filter)
        from .grouping import drop_obsolete_parent_items
        for offer in qs:
            drop_obsolete_parent_items(offer)
        return qs


class AdminServiceDetailView(generics.RetrieveUpdateAPIView):
    queryset = Service.objects.all().select_related(
        'category', 'business', 'business__primary_category', 'professional', 'parent',
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
        old_status = service.status
        service.status = new_status
        service.save(update_fields=['status', 'updated_at'])
        log_audit_event(
            user=request.user,
            action='SERVICE_STATUS',
            resource=f'Service #{service.id}',
            request=request,
            old_value=old_status,
            new_value=new_status,
        )
        return Response(AdminServiceSerializer(service).data)


class ServiceReviewView(APIView):
    """Note 1 à 5. Une seule par client ; une nouvelle note remplace la précédente."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ServicesPublicThrottle]

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
