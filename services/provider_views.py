import logging
import re
from uuid import UUID

from datetime import timedelta

from django.conf import settings
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.outbound_mail import send_isoko_mail
from accounts.services import log_audit_event
from business_categories.models import ModuleKey

logger = logging.getLogger(__name__)

from .models import (
    ContactMessage,
    ContactRequest,
    ProviderDocument,
    Service,
    ServiceProviderProfile,
    TeamMember,
)
from .pagination import ServicesPageNumberPagination
from .permissions import IsServicesProvider, is_services_business, services_tenant_business
from .provider_serializers import (
    ContactRequestDetailSerializer,
    ContactRequestSerializer,
    MerchantOfferSerializer,
    ProviderDocumentSerializer,
    ProviderProfileSerializer,
    PublicContactSerializer,
    PublicOfferSerializer,
    PublicProviderListSerializer,
    PublicProviderSerializer,
    TeamMemberSerializer,
)
from .throttling import ServicesPublicThrottle


def ensure_profile(business):
    profile, _ = ServiceProviderProfile.objects.get_or_create(
        business=business,
        defaults={
            'commercial_name': business.name,
            'about': business.description or '',
        },
    )
    return profile


def _uuid_or_none(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _search_tokens(raw):
    cleaned = re.sub(r"['’]+", ' ', (raw or '').strip())
    return [token for token in re.split(r'\s+', cleaned) if token]


def _provider_search_q(token):
    return (
        Q(commercial_name__icontains=token)
        | Q(business__name__icontains=token)
        | Q(business__commune__icontains=token)
        | Q(business__province__icontains=token)
        | Q(business__primary_category__name__icontains=token)
        | Q(coverage_zones__icontains=token)
        | Q(business__services__title__icontains=token)
        | Q(business__services__sub_items__title__icontains=token)
    )


def services_module_q():
    return (
        Q(business__primary_category__module=ModuleKey.SERVICES)
        | Q(business__primary_category__parent__module=ModuleKey.SERVICES)
    )


def published_providers():
    return ServiceProviderProfile.objects.filter(
        is_published=True,
        business__is_active=True,
        business__is_verified=True,
        business__verification_status='APPROVED',
    ).select_related(
        'business',
        'business__primary_category',
        'business__primary_category__parent',
        'business__owner',
    )


def _active_services_prefetch():
    return Prefetch(
        'business__services',
        queryset=Service.objects.filter(status='ACTIVE').select_related(
            'parent', 'business__primary_category',
        ).prefetch_related('sub_items').order_by('sort_order', 'title'),
    )


class PublicProviderListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicProviderListSerializer
    pagination_class = ServicesPageNumberPagination

    def get_queryset(self):
        qs = published_providers().filter(services_module_q()).prefetch_related(_active_services_prefetch())
        q = (self.request.query_params.get('q') or '').strip()
        category = (self.request.query_params.get('category') or '').strip()
        commune = (self.request.query_params.get('commune') or '').strip()
        availability = (self.request.query_params.get('availability') or '').strip()
        if q:
            for token in _search_tokens(q):
                qs = qs.filter(_provider_search_q(token))
            qs = qs.distinct()
        if category:
            cat_q = (
                Q(business__primary_category__slug=category)
                | Q(business__primary_category__name__iexact=category)
                | Q(business__primary_category__parent__slug=category)
            )
            category_id = _uuid_or_none(category)
            if category_id:
                cat_q |= Q(business__primary_category_id=category_id)
            qs = qs.filter(cat_q)
        if commune:
            qs = qs.filter(
                Q(business__commune__icontains=commune)
                | Q(coverage_zones__icontains=commune)
            )
        if availability:
            qs = qs.filter(business__services__availability__icontains=availability).distinct()
        return qs.order_by('commercial_name', 'business__name')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        communes = list(
            published_providers().filter(services_module_q()).exclude(
                business__commune='',
            ).values_list('business__commune', flat=True).distinct().order_by('business__commune')[:200]
        )
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        response = self.get_paginated_response(serializer.data)
        response.data['communes'] = communes
        return response


class PublicProviderDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        profile = published_providers().prefetch_related(
            _active_services_prefetch(),
            'business__service_team',
            'business__service_documents',
        ).filter(
            Q(pk=pk) | Q(business_id=pk)
        ).first()
        if not profile or not is_services_business(profile.business):
            return Response({'error': 'Prestataire introuvable.'}, status=404)
        return Response(PublicProviderSerializer(profile).data)


class PublicOfferDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        offer = Service.objects.filter(
            pk=pk, status='ACTIVE',
        ).select_related('business', 'business__service_provider_profile', 'category').prefetch_related('sub_items').first()
        if not offer or not is_services_business(offer.business):
            return Response({'error': 'Service introuvable.'}, status=404)
        profile = getattr(offer.business, 'service_provider_profile', None)
        if profile and not profile.is_published:
            return Response({'error': 'Service introuvable.'}, status=404)
        data = PublicOfferSerializer(offer).data
        if profile:
            data['provider'] = PublicProviderListSerializer(profile).data
        return Response(data)


def _provider_mailboxes(business):
    recipients = []
    for raw in (business.email, getattr(business.owner, 'email', '')):
        value = (raw or '').strip()
        if value and value not in recipients:
            recipients.append(value)
    return recipients


def _safe_contact_mail(subject, body, recipients, reply_to=None):
    people = [item for item in (recipients or []) if item]
    if not people:
        return
    try:
        send_isoko_mail(subject, body, people, reply_to=reply_to)
    except Exception:
        logger.exception('Échec e-mail demande de service')


def _offer_label(row, service=None):
    chosen = service or getattr(row, 'service', None)
    return chosen.title if chosen else 'votre activité'


def follow_url(row):
    base = (getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173').rstrip('/')
    return f'{base}/services/demandes/{row.public_token}'


def _request_by_token(token):
    value = (token or '').strip()
    if not value:
        return None
    return ContactRequest.objects.select_related(
        'service', 'business', 'business__service_provider_profile',
    ).prefetch_related('thread').filter(public_token=value).first()


def _message_body(raw):
    text = (raw or '').strip()
    if not text:
        return None
    return text[:4000]


def _add_thread_message(row, *, kind, body, user=None):
    return ContactMessage.objects.create(
        request=row,
        kind=kind,
        body=body,
        author=user if getattr(user, 'is_authenticated', False) else None,
    )


def _notify_new_contact(row, business, service=None):
    offer_label = _offer_label(row, service)
    provider_name = ensure_profile(business).display_name() or business.name
    link = follow_url(row)
    _safe_contact_mail(
        f'Nouvelle demande {row.reference} — {offer_label}',
        (
            f'Bonjour,\n\n'
            f'Dossier {row.reference} : {row.client_name} vous contacte au sujet de {offer_label}.\n'
            f'E-mail : {row.client_email}\n'
            f'Téléphone : {row.client_phone or "—"}\n'
            f'Adresse : {row.client_address or "—"}\n\n'
            f'{row.message}\n\n'
            f'Répondez dans Demandes sur Isoko Hub, ou répondez à cet e-mail.\n'
        ),
        _provider_mailboxes(business),
        reply_to=row.client_email,
    )
    _safe_contact_mail(
        f'Votre demande {row.reference} — {offer_label}',
        (
            f'Bonjour {row.client_name},\n\n'
            f'Votre demande {row.reference} a bien été transmise à {provider_name}.\n'
            f'Sujet : {offer_label}\n\n'
            f'{row.message}\n\n'
            f'Suivez le dossier : {link}\n'
        ),
        [row.client_email],
        reply_to=(business.email or '').strip() or None,
    )


def _notify_contact_status(row, business):
    offer_label = _offer_label(row)
    provider_name = ensure_profile(business).display_name() or business.name
    _safe_contact_mail(
        f'Mise à jour {row.reference} — {offer_label}',
        (
            f'Bonjour {row.client_name},\n\n'
            f'{provider_name} a mis à jour votre demande {row.reference} (« {offer_label} ») : {row.get_status_display()}.\n\n'
            f'Suivez le dossier : {follow_url(row)}\n'
        ),
        [row.client_email],
        reply_to=(business.email or '').strip() or None,
    )


def _notify_provider_reply(row, business, body):
    offer_label = _offer_label(row)
    provider_name = ensure_profile(business).display_name() or business.name
    _safe_contact_mail(
        f'Réponse {row.reference} — {offer_label}',
        (
            f'Bonjour {row.client_name},\n\n'
            f'{provider_name} a répondu à votre demande {row.reference} :\n\n'
            f'{body}\n\n'
            f'Suivez le dossier : {follow_url(row)}\n'
        ),
        [row.client_email],
        reply_to=(business.email or '').strip() or None,
    )


def _notify_client_followup(row, business, body):
    offer_label = _offer_label(row)
    _safe_contact_mail(
        f'Suite {row.reference} — {offer_label}',
        (
            f'Bonjour,\n\n'
            f'{row.client_name} a ajouté un message au dossier {row.reference} ({offer_label}) :\n\n'
            f'{body}\n\n'
            f'Ouvrez Demandes dans Isoko Hub.\n'
        ),
        _provider_mailboxes(business),
        reply_to=row.client_email,
    )


def _create_contact(request, business, service=None):
    serializer = PublicContactSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    service_id = data.get('service_id')
    if service_id and service is None:
        service = Service.objects.filter(pk=service_id, business=business, status='ACTIVE').first()
        if not service:
            return Response({'error': 'Ce service n’appartient pas à ce prestataire.'}, status=400)
    user = request.user if request.user.is_authenticated else None
    row = ContactRequest.objects.create(
        business=business,
        service=service,
        client=user,
        client_name=data['client_name'].strip(),
        client_email=data['client_email'].strip(),
        client_phone=(data.get('client_phone') or '').strip(),
        client_address=(data.get('client_address') or '').strip(),
        preferred_contact=data.get('preferred_contact') or 'EITHER',
        message=data['message'].strip(),
    )
    _add_thread_message(row, kind='CLIENT', body=row.message, user=user)
    _notify_new_contact(row, business, service)
    return Response(
        {
            'ok': True,
            'message': (
                f'Votre demande {row.reference} a été envoyée. '
                'Conservez ce numéro. Le prestataire vous recontactera.'
            ),
            'id': str(row.id),
            'reference': row.reference,
            'follow_url': follow_url(row),
        },
        status=201,
    )


class PublicProviderContactView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ServicesPublicThrottle]

    def post(self, request, pk):
        profile = published_providers().filter(Q(pk=pk) | Q(business_id=pk)).first()
        if not profile:
            return Response({'error': 'Prestataire introuvable.'}, status=404)
        return _create_contact(request, profile.business)


class PublicOfferContactView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ServicesPublicThrottle]

    def post(self, request, pk):
        offer = Service.objects.filter(pk=pk, status='ACTIVE').select_related('business').first()
        if not offer or not is_services_business(offer.business):
            return Response({'error': 'Service introuvable.'}, status=404)
        return _create_contact(request, offer.business, offer)


class MerchantProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsServicesProvider]

    def get(self, request):
        business = services_tenant_business(request.user)
        profile = ensure_profile(business)
        return Response(ProviderProfileSerializer(profile).data)

    def patch(self, request):
        business = services_tenant_business(request.user)
        profile = ensure_profile(business)
        serializer = ProviderProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MerchantOfferViewSet(viewsets.ModelViewSet):
    serializer_class = MerchantOfferSerializer
    permission_classes = [permissions.IsAuthenticated, IsServicesProvider]
    pagination_class = None

    def get_queryset(self):
        business = services_tenant_business(self.request.user)
        if not business:
            return Service.objects.none()
        return Service.objects.filter(business=business).select_related(
            'category', 'parent', 'business__primary_category',
        ).prefetch_related('sub_items').order_by('sort_order', 'title', '-created_at')

    def perform_create(self, serializer):
        business = services_tenant_business(self.request.user)
        offer = serializer.save(business=business, professional=self.request.user)
        log_audit_event(
            user=self.request.user,
            action='SERVICE_OFFER_CREATE',
            resource=f'Service #{offer.id}',
            request=self.request,
            new_value=offer.title,
        )

    def perform_update(self, serializer):
        offer = serializer.save(business=services_tenant_business(self.request.user))
        log_audit_event(
            user=self.request.user,
            action='SERVICE_OFFER_UPDATE',
            resource=f'Service #{offer.id}',
            request=self.request,
            new_value=offer.status,
        )

    def perform_destroy(self, instance):
        log_audit_event(
            user=self.request.user,
            action='SERVICE_OFFER_DELETE',
            resource=f'Service #{instance.id}',
            request=self.request,
            old_value=instance.title,
        )
        instance.delete()


class MerchantTeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamMemberSerializer
    permission_classes = [permissions.IsAuthenticated, IsServicesProvider]
    pagination_class = None

    def get_queryset(self):
        business = services_tenant_business(self.request.user)
        if not business:
            return TeamMember.objects.none()
        return TeamMember.objects.filter(business=business)

    def perform_create(self, serializer):
        serializer.save(business=services_tenant_business(self.request.user))


class MerchantDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsServicesProvider]
    pagination_class = None

    def get_queryset(self):
        business = services_tenant_business(self.request.user)
        if not business:
            return ProviderDocument.objects.none()
        return ProviderDocument.objects.filter(business=business)

    def perform_create(self, serializer):
        business = services_tenant_business(self.request.user)
        extras = {'business': business}
        if 'sort_order' not in self.request.data:
            extras['sort_order'] = ProviderDocument.objects.filter(business=business).count()
        serializer.save(**extras)


class MerchantInboxViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ContactRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsServicesProvider]
    pagination_class = ServicesPageNumberPagination

    def get_queryset(self):
        business = services_tenant_business(self.request.user)
        if not business:
            return ContactRequest.objects.none()
        qs = ContactRequest.objects.filter(business=business).select_related(
            'service', 'business', 'business__service_provider_profile',
        ).prefetch_related('thread')
        status_filter = (self.request.query_params.get('status') or '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        if (self.request.query_params.get('overdue') or '').strip() in ('1', 'true', 'True'):
            qs = qs.filter(status='NEW', created_at__lte=timezone.now() - timedelta(hours=24))
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ContactRequestDetailSerializer
        return ContactRequestSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['include_internal'] = True
        return ctx

    def retrieve(self, request, *args, **kwargs):
        row = self.get_object()
        if row.status == 'NEW':
            row.status = 'IN_PROGRESS'
            row.save(update_fields=['status', 'updated_at'])
        serializer = self.get_serializer(row)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def set_status(self, request, pk=None):
        row = self.get_object()
        next_status = (request.data.get('status') or '').strip().upper()
        allowed = {key for key, _ in ContactRequest.STATUS_CHOICES}
        if next_status not in allowed:
            return Response({'error': 'Statut invalide.'}, status=400)
        row.status = next_status
        row.save(update_fields=['status', 'updated_at'])
        _notify_contact_status(row, row.business)
        return Response(ContactRequestDetailSerializer(row, context={'include_internal': True}).data)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        row = self.get_object()
        body = _message_body(request.data.get('body'))
        if not body:
            return Response({'error': 'Écrivez une réponse.'}, status=400)
        internal = bool(request.data.get('internal'))
        kind = 'INTERNAL' if internal else 'PROVIDER'
        _add_thread_message(row, kind=kind, body=body, user=request.user)
        if not internal:
            row.status = 'REPLIED'
            row.save(update_fields=['status', 'updated_at'])
            _notify_provider_reply(row, row.business, body)
        row = self.get_queryset().get(pk=row.pk)
        return Response(ContactRequestDetailSerializer(row, context={'include_internal': True}).data)


class ClientRequestViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ServicesPageNumberPagination

    def get_queryset(self):
        user = self.request.user
        email = (getattr(user, 'email', '') or '').strip()
        filt = Q(client=user)
        if email:
            filt |= Q(client_email__iexact=email)
        qs = ContactRequest.objects.filter(filt).select_related(
            'service', 'business', 'business__service_provider_profile',
        ).prefetch_related('thread')
        status_filter = (self.request.query_params.get('status') or '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ContactRequestDetailSerializer
        return ContactRequestSerializer

    @action(detail=True, methods=['post'])
    def messages(self, request, pk=None):
        row = self.get_object()
        return _append_client_message(request, row)


class PublicRequestFollowView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ServicesPublicThrottle]

    def get(self, request, token):
        row = _request_by_token(token)
        if not row:
            return Response({'error': 'Demande introuvable.'}, status=404)
        return Response(ContactRequestDetailSerializer(row).data)


class PublicRequestMessageView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ServicesPublicThrottle]

    def post(self, request, token):
        row = _request_by_token(token)
        if not row:
            return Response({'error': 'Demande introuvable.'}, status=404)
        return _append_client_message(request, row)


def _append_client_message(request, row):
    body = _message_body(request.data.get('body'))
    if not body:
        return Response({'error': 'Écrivez un message.'}, status=400)
    user = request.user if request.user.is_authenticated else None
    _add_thread_message(row, kind='CLIENT', body=body, user=user)
    if row.status == 'CLOSED':
        row.status = 'IN_PROGRESS'
        row.save(update_fields=['status', 'updated_at'])
    _notify_client_followup(row, row.business, body)
    row = ContactRequest.objects.select_related(
        'service', 'business', 'business__service_provider_profile',
    ).prefetch_related('thread').get(pk=row.pk)
    return Response(ContactRequestDetailSerializer(row).data, status=201)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsServicesProvider])
def merchant_dashboard(request):
    business = services_tenant_business(request.user)
    offers = Service.objects.filter(business=business)
    inbox = ContactRequest.objects.filter(business=business)
    overdue = inbox.filter(status='NEW', created_at__lte=timezone.now() - timedelta(hours=24))
    return Response({
        'provider_name': ensure_profile(business).display_name(),
        'offers_total': offers.count(),
        'offers_published': offers.filter(status='ACTIVE').count(),
        'requests_new': inbox.filter(status='NEW').count(),
        'requests_open': inbox.exclude(status='CLOSED').count(),
        'requests_overdue': overdue.count(),
        'team_count': TeamMember.objects.filter(business=business).count(),
    })
