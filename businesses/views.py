from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
import hmac

from .models import (
    Business, BusinessSubscription, SubscriptionPlan, SubscriptionPayment, PlatformNotification,
)
from .serializers import BusinessSerializer, BusinessLiteSerializer, AdminBusinessSerializer
from .tenant import get_user_tenant_business
from .subscription import (
    filter_businesses_with_active_subscription,
    subscription_summary,
    ensure_business_subscription,
    business_has_active_subscription,
    get_or_create_default_plans,
    get_free_plan,
    list_paid_plans,
    list_all_catalog_plans,
    update_catalog_plan,
    activate_subscription_from_payment,
    payment_detail_dict,
    get_grace_period_days,
    update_grace_period_days,
    reset_subscription_notices,
    EXPIRY_WARNING_DAYS,
)
from . import burundipay
from permissions.custom_permissions import IsSuperAdmin, IsBusinessOwner, IsBusinessTenantMember, PlatformMethodPermission


def _business_is_hotel(business):
    if not business:
        return False
    try:
        from hotel.models import HotelProfile
        if HotelProfile.objects.filter(business_id=business.id).exists():
            return True
    except Exception:
        pass
    cat = getattr(business, 'primary_category', None)
    name = (getattr(cat, 'name', '') or '').lower()
    slug = (getattr(cat, 'slug', '') or '').lower()
    parent = (getattr(getattr(cat, 'parent', None), 'name', '') or '').lower()
    return any(
        k in name or k in slug or k in parent
        for k in ('hôtel', 'hotel', 'hôtellerie', 'hotellerie')
    )


class CanManageBusinessRoles(BasePermission):
    """
    Lecture : membre du tenant.
    Écriture hôtel : permission hotel.roles.* (attribuable à n'importe qui) ou propriétaire / manage.
    Autres secteurs : membre du tenant.
    """

    def has_permission(self, request, view):
        if not IsBusinessTenantMember().has_permission(request, view):
            return False
        business = get_user_tenant_business(request.user)
        if not _business_is_hotel(business):
            return True
        from hotel.permissions import can_access_hotel_roles
        method = request.method.upper()
        if method in ('GET', 'HEAD', 'OPTIONS'):
            return can_access_hotel_roles(request.user, business, 'view')
        if method == 'POST':
            return can_access_hotel_roles(request.user, business, 'create')
        if method in ('PUT', 'PATCH'):
            return can_access_hotel_roles(request.user, business, 'update')
        if method == 'DELETE':
            return can_access_hotel_roles(request.user, business, 'delete')
        return can_access_hotel_roles(request.user, business, 'view')


class CanCreateBusiness(BasePermission):
    """
    Création d'entreprise — propriétaire ou professionnel (pas Super Admin plateforme).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'SUPER_ADMIN':
            return False
        return request.user.role in ['BUSINESS_OWNER', 'PROFESSIONAL']

class BusinessListView(generics.ListAPIView):
    """
    Endpoint public pour lister toutes les entreprises validées et actives.
    Permet le filtrage par localisation (province, commune, quartier).
    """
    serializer_class = BusinessSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Business.objects.filter(
            is_active=True,
            is_verified=True,
            verification_status='APPROVED',
        )
        queryset = filter_businesses_with_active_subscription(queryset)
        province = self.request.query_params.get('province')
        commune = self.request.query_params.get('commune')
        quartier = self.request.query_params.get('quartier')

        if province:
            queryset = queryset.filter(province__iexact=province.strip())
        if commune:
            queryset = queryset.filter(commune__iexact=commune.strip())
        if quartier:
            queryset = queryset.filter(quartier__icontains=quartier.strip())
        return queryset.select_related(
            'primary_category', 'primary_category__parent', 'hospital_profile'
        ).prefetch_related('categories', 'categories__parent')

class BusinessDetailView(generics.RetrieveAPIView):
    """
    Endpoint public pour récupérer les détails d'une entreprise spécifique (ex: Hôpital).
    """
    serializer_class = BusinessSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return filter_businesses_with_active_subscription(
            Business.objects.filter(
                is_active=True,
                is_verified=True,
                verification_status='APPROVED',
            )
        ).select_related(
            'primary_category', 'primary_category__parent', 'hospital_profile'
        ).prefetch_related('categories', 'categories__parent')


class MyBusinessListView(generics.ListCreateAPIView):
    """
    Endpoint pour qu'un utilisateur puisse lister ses entreprises, en créer et les modifier.
    """
    serializer_class = BusinessSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        # GET /me/ était ~4 Mo (fields=__all__ + catégories) → timeouts / 502 via le proxy Vite.
        if self.request.method == 'GET':
            return BusinessLiteSerializer
        return BusinessSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Business.objects.none()
        if user.role == 'SUPER_ADMIN':
            qs = Business.objects.none()
        elif user.role == 'BUSINESS_OWNER':
            qs = Business.objects.filter(owner=user)
        else:
            # Employés / professionnels : entreprise du tenant (pas seulement PROFESSIONAL)
            business = get_user_tenant_business(user)
            if business:
                qs = Business.objects.filter(id=business.id)
            else:
                from businesses.models import BusinessEmployee
                emp_ids = BusinessEmployee.objects.filter(
                    user=user, is_active=True,
                ).values_list('business_id', flat=True)
                qs = Business.objects.filter(id__in=emp_ids)
        return qs.select_related('primary_category', 'hospital_profile').prefetch_related('categories')

    def perform_create(self, serializer):
        # Assigne automatiquement l'utilisateur connecté comme propriétaire
        serializer.save(owner=self.request.user)

    def _resolve_business(self, request):
        """Sélectionne l'entreprise ciblée (multi-entreprises) sans casser le mono-tenant."""
        qs = self.get_queryset().order_by('created_at')
        biz_id = (
            request.query_params.get('business')
            or request.query_params.get('business_id')
            or request.headers.get('X-Business-Id')
            or (request.data.get('id') if hasattr(request.data, 'get') else None)
        )
        if biz_id:
            business = qs.filter(id=biz_id).first()
            if not business:
                return None
            return business
        return qs.first()

    def put(self, request, *args, **kwargs):
        business = self._resolve_business(request)
        if not business:
            return Response({"detail": "Aucune entreprise trouvée."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(business, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):
        return self.put(request, *args, **kwargs)

class AdminBusinessListView(generics.ListCreateAPIView):
    queryset = Business.objects.all().order_by('-created_at')
    serializer_class = AdminBusinessSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': 'platform.businesses.view',
        'POST': 'platform.businesses.create',
    }

class AdminBusinessDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Business.objects.all()
    serializer_class = AdminBusinessSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': 'platform.businesses.view',
        'PUT': 'platform.businesses.update',
        'PATCH': 'platform.businesses.update',
        'DELETE': 'platform.businesses.delete',
    }

    def update(self, request, *args, **kwargs):
        from accounts.platform_access import user_has_platform_perm
        from accounts.models import AuditLog

        if 'is_active' in request.data and not user_has_platform_perm(request.user, 'platform.businesses.suspend'):
            return Response(
                {'detail': 'La suspension d’une entreprise exige le droit platform.businesses.suspend.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = self.get_object()
        previous_active = bool(instance.is_active)
        response = super().update(request, *args, **kwargs)
        if response.status_code < 400 and 'is_active' in request.data:
            instance.refresh_from_db(fields=['is_active', 'name'])
            now_active = bool(instance.is_active)
            if now_active != previous_active:
                AuditLog.objects.create(
                    user=request.user,
                    user_email=getattr(request.user, 'email', '') or '',
                    user_role=getattr(request.user, 'role', '') or '',
                    action='BUSINESS_REACTIVATED' if now_active else 'BUSINESS_SUSPENDED',
                    resource=f'business:{instance.id}',
                    details={
                        'business_name': instance.name,
                        'business_id': str(instance.id),
                        'is_active': now_active,
                    },
                )
        return response

    def destroy(self, request, *args, **kwargs):
        """
        Supprime définitivement l'entreprise et ses données liées (CASCADE).
        """
        instance = self.get_object()
        name = instance.name
        business_id = str(instance.id)
        try:
            instance.delete()
        except Exception as exc:
            return Response(
                {
                    'error': (
                        f'Impossible de supprimer « {name} » : {exc}. '
                        'Retrait du catalogue public à la place.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                'message': f'Entreprise « {name} » supprimée.',
                'id': business_id,
                'deleted': True,
            },
            status=status.HTTP_200_OK,
        )

from .models import BusinessEmployee, BusinessRole
from .serializers import BusinessEmployeeSerializer, BusinessRoleSerializer

class BusinessRoleListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessRoleSerializer
    permission_classes = [CanManageBusinessRoles]

    def get_queryset(self):
        business = get_user_tenant_business(self.request.user)
        if business:
            return BusinessRole.objects.filter(business=business)
        return BusinessRole.objects.none()

    def perform_create(self, serializer):
        business = get_user_tenant_business(self.request.user)
        serializer.save(business=business)

class BusinessRoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BusinessRoleSerializer
    permission_classes = [CanManageBusinessRoles]

    def get_queryset(self):
        business = get_user_tenant_business(self.request.user)
        if business:
            return BusinessRole.objects.filter(business=business)
        return BusinessRole.objects.none()

    def perform_update(self, serializer):
        instance = self.get_object()
        from hotel.role_defaults import is_hotel_owner_role, OWNER_ROLE_NAME
        if is_hotel_owner_role(instance):
            # Nom / niveau du rôle Propriétaire verrouillés
            serializer.save(name=OWNER_ROLE_NAME, system_access_level='OWNER_ACCESS')
            return
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        from hotel.role_defaults import is_hotel_owner_role
        business = get_user_tenant_business(request.user)
        if _business_is_hotel(business) and is_hotel_owner_role(instance):
            return Response(
                {'detail': 'Le rôle Propriétaire ne peut pas être supprimé.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class SeedReceptionistRoleView(APIView):
    """Crée ou met à jour le rôle standard « Agent d'accueil » avec ses permissions."""
    permission_classes = [CanManageBusinessRoles]

    def post(self, request):
        from hospital.reception_constants import RECEPTIONIST_ROLE_DEFAULTS

        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'detail': 'Aucune entreprise associée.'}, status=status.HTTP_400_BAD_REQUEST)

        role, created = BusinessRole.objects.update_or_create(
            business=business,
            name=RECEPTIONIST_ROLE_DEFAULTS['name'],
            defaults={
                'system_access_level': RECEPTIONIST_ROLE_DEFAULTS['system_access_level'],
                'permissions': RECEPTIONIST_ROLE_DEFAULTS['permissions'],
            },
        )
        serializer = BusinessRoleSerializer(role)
        return Response(
            {
                'created': created,
                'message': 'Rôle Agent d\'accueil prêt à être assigné au personnel.',
                'role': serializer.data,
                'permissions_granted': RECEPTIONIST_ROLE_DEFAULTS['permissions'],
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BusinessEmployeeListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessEmployeeSerializer
    permission_classes = [IsBusinessTenantMember]

    def get_queryset(self):
        business = get_user_tenant_business(self.request.user)
        if business:
            return BusinessEmployee.objects.filter(business=business).exclude(
                user__role='SUPER_ADMIN'
            )
        return BusinessEmployee.objects.none()

    def create(self, request, *args, **kwargs):
        """
        Crée / rattache un collaborateur au tenant.
        Comme l'admin hôpital (ManageDoctors) : email + password créent le compte de connexion.
        Champs : email (requis), password (requis si nouveau compte), first_name, last_name,
                 position, role_id.
        """
        from django.db import transaction

        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'detail': 'Aucune entreprise associée à votre compte.'}, status=status.HTTP_400_BAD_REQUEST)

        email = (request.data.get('email') or '').strip().lower()
        position = (request.data.get('position') or 'STAFF').strip() or 'STAFF'
        role_id = request.data.get('role_id')
        password = request.data.get('password') or ''
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()

        from accounts.email_identity import normalize_login_email, get_user_by_login_email, emails_strictly_equal
        email = normalize_login_email(email)

        if not email or '@' not in email:
            return Response({'email': 'L\'email est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        account_created = False
        with transaction.atomic():
            # Correspondance STRICTE uniquement (m@gmail.com ≠ ma@gmail.com)
            user = get_user_by_login_email(email)
            if user and not emails_strictly_equal(user.email, email):
                user = None

            if user is None:
                if not password or len(str(password)) < 8:
                    return Response(
                        {
                            'password': (
                                'Mot de passe requis (min. 8 caractères) pour créer '
                                'le compte de connexion de ce collaborateur.'
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user = User(
                    email=email,
                    first_name=first_name or email.split('@')[0],
                    last_name=last_name,
                    role='PROFESSIONAL',
                    is_active=True,
                )
                user.set_password(password)
                user.save()
                account_created = True
            else:
                if user.role == 'SUPER_ADMIN':
                    return Response(
                        {'email': 'Le super administrateur plateforme ne peut pas être ajouté au personnel d\'une entreprise.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if BusinessEmployee.objects.filter(business=business, user=user).exists():
                    return Response(
                        {
                            'email': (
                                f'Le compte {user.email} est déjà un employé de cette entreprise. '
                                'Attention : m@gmail.com et ma@gmail.com sont deux adresses différentes.'
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # Compte déjà existant : ne JAMAIS écraser prénom/nom
                # (sinon un proprio pharmacie rattaché à un hôtel devient « Manager hotel » partout)
                fields_changed = False
                if password and len(str(password)) >= 8:
                    user.set_password(password)
                    fields_changed = True
                if user.role == 'CUSTOMER':
                    user.role = 'PROFESSIONAL'
                    fields_changed = True
                if fields_changed:
                    user.save()

            role = None
            if role_id:
                role = BusinessRole.objects.filter(id=role_id, business=business).first()

            employee = BusinessEmployee.objects.create(
                business=business, user=user, position=position, role=role,
            )

        serializer = self.get_serializer(employee)
        data = serializer.data
        data['account_created'] = account_created
        data['login_email'] = user.email
        data['message'] = (
            f'Nouveau compte créé pour {user.email}. Communiquez l\'email et le mot de passe au collaborateur.'
            if account_created
            else f'Collaborateur rattaché au compte existant {user.email} (email exact, pas un alias).'
        )
        return Response(data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        # create() gère déjà la logique métier
        pass

class BusinessEmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BusinessEmployeeSerializer
    permission_classes = [IsBusinessTenantMember]

    def get_queryset(self):
        business = get_user_tenant_business(self.request.user)
        if business:
            return BusinessEmployee.objects.filter(business=business).exclude(
                user__role='SUPER_ADMIN'
            )
        return BusinessEmployee.objects.none()

    def update(self, request, *args, **kwargs):
        from django.db import transaction
        from django.contrib.auth import get_user_model

        instance = self.get_object()
        role_id = request.data.get('role_id')
        position = request.data.get('position')
        password = request.data.get('password') or ''
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email_raw = request.data.get('email')

        if position is not None:
            instance.position = position
        if role_id:
            try:
                role = BusinessRole.objects.get(id=role_id, business=instance.business)
                instance.role = role
            except BusinessRole.DoesNotExist:
                pass

        user = instance.user
        # Ne pas écraser l'identité d'un propriétaire d'une AUTRE entreprise
        owns_other = user.businesses.exclude(pk=instance.business_id).exists()
        if not owns_other:
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name
        elif first_name is not None or last_name is not None:
            # Ignorer silencieusement le renommage cross-tenant (le rôle/poste restent modifiables)
            pass
        if password and len(str(password)) >= 8:
            user.set_password(password)

        email_changed = False
        if email_raw is not None:
            new_email = str(email_raw).strip().lower()
            if not new_email:
                return Response({'email': 'L\'email ne peut pas être vide.'}, status=status.HTTP_400_BAD_REQUEST)
            if new_email != (user.email or '').strip().lower():
                from accounts.email_identity import get_user_by_login_email, emails_strictly_equal
                conflict = get_user_by_login_email(new_email)
                if conflict and conflict.pk != user.pk and emails_strictly_equal(conflict.email, new_email):
                    return Response(
                        {
                            'email': (
                                f'Un compte utilise déjà exactement « {conflict.email} ». '
                                'Deux adresses proches restent distinctes '
                                '(ex. m@gmail.com ≠ ma@gmail.com).'
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.email = new_email
                email_changed = True

        with transaction.atomic():
            user.save()
            instance.save()

        serializer = self.get_serializer(instance)
        data = serializer.data
        if email_changed:
            data['login_email'] = user.email
            data['email_changed'] = True
            data['message'] = (
                'Email de connexion mis à jour. Communiquez la nouvelle adresse au collaborateur.'
            )
        return Response(data)

# --- VIEWS DE MODÉRATION ET IMPORTATION CSV ---
from business_categories.models import BusinessCategory
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


def _business_notification_email(business):
    """Email professionnel de l'entreprise, sinon email du propriétaire."""
    return (business.email or '').strip() or (getattr(business.owner, 'email', None) or '').strip()


def _parse_optional_float(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def send_business_approval_email(business, admin_message=''):
    """Confirme l'acceptation d'inscription à l'email de l'entreprise."""
    recipient = _business_notification_email(business)
    if not recipient:
        return {'status': 'SKIPPED', 'reason': 'Aucun email entreprise/propriétaire'}

    frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173'
    login_url = f'{frontend_url.rstrip("/")}/login'
    category = getattr(business.primary_category, 'name', None) or 'Non spécifiée'
    admin_block = ''
    if (admin_message or '').strip():
        admin_block = (
            f'\nMessage de l’équipe Isoko Hub :\n'
            f'{admin_message.strip()}\n'
        )
    subject = f'Isoko Hub — Votre entreprise « {business.name} » a été approuvée'
    message = (
        f'Bonjour,\n\n'
        f'Bonne nouvelle : l’inscription de votre entreprise a été acceptée sur Isoko Hub.\n\n'
        f'Entreprise : {business.name}\n'
        f'Catégorie : {category}\n'
        f'Statut : Approuvée / Active\n'
        f'{admin_block}\n'
        f'Vous pouvez dès maintenant vous connecter à votre espace professionnel :\n'
        f'{login_url}\n\n'
        f'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.\n\n'
        f'— L’équipe Isoko Hub\n'
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'info.isokohub@gmail.com'),
            recipient_list=[recipient],
            fail_silently=False,
        )
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        logger.exception('Échec email approbation entreprise %s', business.id)
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}


def send_business_rejection_email(business, reason=''):
    """Informe l'entreprise du refus d'inscription."""
    recipient = _business_notification_email(business)
    if not recipient:
        return {'status': 'SKIPPED', 'reason': 'Aucun email entreprise/propriétaire'}

    category = getattr(business.primary_category, 'name', None) or 'Non spécifiée'
    reason_text = (reason or '').strip() or 'Non conforme aux exigences du secteur.'
    subject = f'Isoko Hub — Inscription refusée pour « {business.name} »'
    message = (
        f'Bonjour,\n\n'
        f'Après examen de votre dossier, l’inscription de votre entreprise sur Isoko Hub '
        f'n’a pas pu être acceptée pour le moment.\n\n'
        f'Entreprise : {business.name}\n'
        f'Catégorie : {category}\n'
        f'Statut : Refusée\n\n'
        f'Motif du refus :\n{reason_text}\n\n'
        f'Vous pouvez corriger votre dossier et nous recontacter si nécessaire.\n\n'
        f'— L’équipe Isoko Hub\n'
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'info.isokohub@gmail.com'),
            recipient_list=[recipient],
            fail_silently=False,
        )
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        logger.exception('Échec email rejet entreprise %s', business.id)
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}


class AdminModerationListView(generics.ListAPIView):
    queryset = Business.objects.filter(verification_status='PENDING').order_by('-created_at')
    serializer_class = AdminBusinessSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.businesses.view'}


class AdminModerationDeskView(APIView):
    """Tableau de bord Modération : volumes + file d’attente + décisions récentes."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.businesses.view'}

    def get(self, request):
        from accounts.models import AuditLog

        now = timezone.now()
        week_ago = now - timedelta(days=7)
        qs = Business.objects.select_related('owner', 'primary_category')
        pending_qs = qs.filter(verification_status='PENDING').order_by('-created_at')
        approved_count = qs.filter(verification_status='APPROVED').count()
        rejected_count = qs.filter(verification_status='REJECTED').count()
        pending_count = pending_qs.count()
        suspended_count = qs.filter(is_active=False).exclude(verification_status='REJECTED').count()
        active_qs = qs.filter(verification_status='APPROVED', is_active=True).order_by('-updated_at')
        suspended_qs = qs.filter(is_active=False).exclude(verification_status='REJECTED').order_by('-updated_at')

        by_category = {}
        for row in pending_qs[:200]:
            label = getattr(row.primary_category, 'name', None) or 'Sans catégorie'
            by_category[label] = by_category.get(label, 0) + 1

        decisions = []
        for log in AuditLog.objects.filter(
            action__in=('BUSINESS_APPROVED', 'BUSINESS_REJECTED', 'BUSINESS_SUSPENDED', 'BUSINESS_REACTIVATED'),
            created_at__gte=week_ago,
        ).select_related('user').order_by('-created_at')[:20]:
            details = log.details if isinstance(log.details, dict) else {}
            if log.action == 'BUSINESS_APPROVED':
                status_label = 'APPROVED'
            elif log.action == 'BUSINESS_REJECTED':
                status_label = 'REJECTED'
            elif log.action == 'BUSINESS_SUSPENDED':
                status_label = 'SUSPENDED'
            else:
                status_label = 'REACTIVATED'
            decisions.append({
                'id': str(log.id),
                'action': log.action,
                'business_name': details.get('business_name') or log.resource,
                'actor_email': log.user_email or getattr(log.user, 'email', None),
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'status': status_label,
            })

        pending = AdminBusinessSerializer(pending_qs[:50], many=True).data
        active = AdminBusinessSerializer(active_qs[:30], many=True).data
        suspended = AdminBusinessSerializer(suspended_qs[:30], many=True).data
        return Response({
            'metrics': {
                'pending': pending_count,
                'approved': approved_count,
                'rejected': rejected_count,
                'suspended': suspended_count,
                'decisions_week': len(decisions),
                'missing_logo': sum(1 for b in pending if not (b.get('logo') or '').strip()),
                'missing_docs': sum(
                    1 for b in pending
                    if not (b.get('proof_document') or '').strip()
                    and not (b.get('commerce_compliance') or {}).get('nif_document')
                ),
            },
            'by_category': [
                {'name': name, 'count': count}
                for name, count in sorted(by_category.items(), key=lambda item: (-item[1], item[0]))
            ],
            'pending': pending,
            'active': active,
            'suspended': suspended,
            'recent_decisions': decisions,
            'generated_at': now.isoformat(),
        })


class AdminModerationApproveView(APIView):
    """Approuve une entreprise (PENDING ou REJECTED) → Actif & Approuvé."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'POST': 'platform.businesses.approve'}

    def post(self, request, pk):
        try:
            business = Business.objects.select_related('owner', 'primary_category').get(pk=pk)
            previous = business.verification_status
            admin_message = (request.data.get('message') or request.data.get('admin_message') or '').strip()
            business.verification_status = 'APPROVED'
            business.is_verified = True
            business.is_active = True
            business.rejection_reason = ''
            business.save(update_fields=[
                'verification_status', 'is_verified', 'is_active',
                'rejection_reason', 'updated_at',
            ])
            # Activer profil pharmacie de gros si présent
            try:
                from wholesale.order_workflow import ensure_wholesale_profile
                from wholesale.views import is_wholesale_business
                if is_wholesale_business(business):
                    profile = ensure_wholesale_profile(business)
                    if profile.status in ('DRAFT', 'SUSPENDED', 'CLOSED'):
                        profile.status = 'ACTIVE'
                        profile.save(update_fields=['status', 'updated_at'])
            except Exception:
                logger.exception('Activation profil wholesale pour %s', business.id)
            # Activer profil pharmacie de détail si présent
            try:
                from retail.order_workflow import ensure_retail_profile
                from retail.permissions import is_retail_pharmacy
                if is_retail_pharmacy(business):
                    profile = ensure_retail_profile(business)
                    if profile.status in ('DRAFT', 'SUSPENDED', 'CLOSED'):
                        profile.status = 'ACTIVE'
                        profile.save(update_fields=['status', 'updated_at'])
            except Exception:
                logger.exception('Activation profil retail pour %s', business.id)

            email_result = None
            if previous != 'APPROVED':
                email_result = send_business_approval_email(business, admin_message=admin_message)
            from accounts.services import log_audit_event
            log_audit_event(
                user=request.user,
                action='BUSINESS_APPROVED',
                resource=f'business:{business.id}',
                request=request,
                status='SUCCESS',
                details={'business_name': business.name, 'on_behalf': True},
            )
            return Response({
                'message': f'L\'entreprise "{business.name}" est maintenant Active & Approuvée.',
                'verification_status': 'APPROVED',
                'is_active': True,
                'is_verified': True,
                'email_notification': email_result,
            })
        except Business.DoesNotExist:
            return Response({'error': 'Entreprise introuvable'}, status=status.HTTP_404_NOT_FOUND)


class AdminModerationRejectView(APIView):
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'POST': 'platform.businesses.reject'}

    def post(self, request, pk):
        try:
            business = Business.objects.select_related('owner', 'primary_category').get(pk=pk)
            reason = (request.data.get('reason') or request.data.get('message') or '').strip()
            if not reason:
                return Response(
                    {'error': 'Un motif de refus est obligatoire avant de rejeter l’inscription.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            business.verification_status = 'REJECTED'
            business.is_verified = False
            business.is_active = False
            business.rejection_reason = reason
            business.save(update_fields=[
                'verification_status', 'is_verified', 'is_active',
                'rejection_reason', 'updated_at',
            ])
            email_result = send_business_rejection_email(business, reason=reason)
            from accounts.services import log_audit_event
            log_audit_event(
                user=request.user,
                action='BUSINESS_REJECTED',
                resource=f'business:{business.id}',
                request=request,
                status='SUCCESS',
                details={'business_name': business.name, 'on_behalf': True, 'reason': reason},
            )
            return Response({
                'message': f'L\'entreprise "{business.name}" a été rejetée.',
                'email_notification': email_result,
            })
        except Business.DoesNotExist:
            return Response({'error': 'Entreprise introuvable'}, status=status.HTTP_404_NOT_FOUND)

class AdminCSVImportView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        items = request.data.get('items', [])
        if not items:
            return Response({'error': 'Aucune donnée d\'entreprise fournie.'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []

        # Index existing categories by lowercase name for fast matching
        all_categories = {c.name.lower(): c for c in BusinessCategory.objects.all()}

        for idx, row in enumerate(items, start=1):
            try:
                name = row.get('name') or row.get('Nom')
                email = row.get('email') or row.get('Email')
                phone = row.get('phone') or row.get('Téléphone') or ''
                address = row.get('address') or row.get('Adresse') or ''
                province = row.get('province') or row.get('Province') or 'Bujumbura Mairie'
                commune = row.get('commune') or row.get('Commune') or ''
                quartier = row.get('quartier') or row.get('Quartier') or ''
                sector_name = row.get('sector') or row.get('Secteur_Parent') or ''
                sub_cats = row.get('sub_categories') or row.get('Sous_Categories') or ''

                if not name or not email:
                    errors.append(f"Ligne {idx}: Nom et Email requis.")
                    continue

                # 1. User Creation/Get
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'role': 'BUSINESS_OWNER',
                        'first_name': name,
                        'is_active': True
                    }
                )
                if created:
                    user.set_password('Isoko123!')
                    user.save()

                # 2. Match Primary Category
                primary_cat = None
                if sector_name:
                    primary_cat = all_categories.get(sector_name.strip().lower())

                # 3. Create Business
                business = Business.objects.create(
                    name=name,
                    owner=user,
                    email=email,
                    phone=phone,
                    address=address,
                    province=province,
                    commune=commune,
                    quartier=quartier,
                    primary_category=primary_cat,
                    is_active=True,
                    is_verified=True,
                    verification_status='APPROVED'
                )

                # 4. Secondary categories matching
                if sub_cats:
                    sub_list = [s.strip().lower() for s in sub_cats.split(',')]
                    matched_ids = []
                    for s_name in sub_list:
                        if s_name in all_categories:
                            matched_ids.append(all_categories[s_name].id)
                    if matched_ids:
                        business.categories.set(matched_ids)

                created_count += 1

            except Exception as e:
                errors.append(f"Ligne {idx} ({row.get('name', 'Inconnu')}): {str(e)}")

        return Response({
            'message': f"{created_count} entreprise(s) importée(s) avec succès.",
            'created_count': created_count,
            'errors': errors
        })

class PublicBusinessRegistrationView(APIView):
    """
    Endpoint public permettant l'inscription d'une nouvelle entreprise (Onboarding).
    Crée le compte utilisateur gérant et l'entreprise avec le statut 'PENDING'.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        data = request.data
        from accounts.email_identity import normalize_login_email, get_user_by_login_email
        email = normalize_login_email(data.get('owner_email_input') or data.get('email'))
        password = data.get('password')
        name = data.get('name')
        
        if not email or not password or not name:
            return Response({'error': 'Le nom de l\'entreprise, l\'email et le mot de passe sont obligatoires.'}, status=status.HTTP_400_BAD_REQUEST)

        logo_data = (data.get('logo') or '').strip()
        owner_avatar = (
            data.get('owner_avatar')
            or data.get('avatar')
            or data.get('profile_image')
            or ''
        ).strip()

        def _valid_image_payload(value):
            return bool(value) and (
                value.startswith('http://')
                or value.startswith('https://')
                or value.startswith('data:image/')
            )

        if not _valid_image_payload(owner_avatar):
            return Response(
                {'error': 'La photo de profil du propriétaire est obligatoire.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _valid_image_payload(logo_data):
            return Response(
                {'error': 'Le logo de l\'établissement est obligatoire.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # 1. Vérification si le nom de l'entreprise existe déjà
        if Business.objects.filter(name__iexact=name).exists():
            return Response({'error': 'Une entreprise avec ce nom existe déjà.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Création ou récupération STRICTE du propriétaire (m@ ≠ ma@)
        try:
            user = get_user_by_login_email(email)
            created = False
            if user is None:
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    role='BUSINESS_OWNER',
                    first_name=data.get('first_name', 'Admin'),
                    last_name=data.get('last_name', name),
                    is_active=True,
                )
                created = True
            else:
                # Si l'utilisateur existe déjà (email EXACT), vérifier le mot de passe
                if not user.check_password(password):
                     return Response({'error': 'Un compte avec cet email existe déjà. Mot de passe incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
                if user.role != 'BUSINESS_OWNER':
                    user.role = 'BUSINESS_OWNER'
                    user.save(update_fields=['role', 'updated_at'])

            # 3. Création de l'entreprise (Tenant)
            primary_cat_id = data.get('primary_category')
            primary_cat = None
            if primary_cat_id:
                try:
                    primary_cat = BusinessCategory.objects.select_related('parent').get(id=primary_cat_id)
                except BusinessCategory.DoesNotExist:
                    pass

            from .commerce import (
                is_commerce_category,
                validate_commerce_registration_documents,
                find_commerce_document_duplicates,
                apply_commerce_compliance,
                normalize_registry_number,
                hash_document_payload,
            )

            if is_commerce_category(primary_cat):
                doc_errors = validate_commerce_registration_documents(data)
                if doc_errors:
                    return Response({'error': ' '.join(doc_errors)}, status=status.HTTP_400_BAD_REQUEST)

                extras = data.get('extra_attributes') or {}
                nif = normalize_registry_number(data.get('nif_number') or extras.get('nif_number') or '')
                nif_doc = (data.get('nif_document') or extras.get('nif_document') or '').strip()
                dup_errors = find_commerce_document_duplicates(
                    nif=nif,
                    nif_hash=hash_document_payload(nif_doc),
                )
                if dup_errors:
                    return Response({'error': ' '.join(dup_errors)}, status=status.HTTP_400_BAD_REQUEST)

            business = Business.objects.create(
                name=name,
                owner=user,
                email=email,
                phone=data.get('phone', ''),
                address=data.get('address', ''),
                province=data.get('province', 'Bujumbura Mairie'),
                commune=data.get('commune', ''),
                zone=data.get('zone', ''),
                quartier=data.get('quartier', ''),
                avenue=data.get('avenue', ''),
                latitude=_parse_optional_float(data.get('latitude')),
                longitude=_parse_optional_float(data.get('longitude')),
                website=data.get('website', ''),
                description=data.get('description', ''),
                primary_category=primary_cat,
                extra_attributes=data.get('extra_attributes', {}),
                verification_status='PENDING',
                is_verified=False,
                is_active=False
            )

            if is_commerce_category(primary_cat):
                apply_commerce_compliance(business, data)

            # Logo établissement (URL ou data:image base64)
            if _valid_image_payload(logo_data):
                business.logo = logo_data
                business.save(update_fields=['logo'])

            # Photo propriétaire → profil utilisateur (visible admin)
            if _valid_image_payload(owner_avatar):
                from profiles.models import Profile
                profile, _ = Profile.objects.get_or_create(user=user)
                profile.avatar = owner_avatar
                profile.save(update_fields=['avatar'])

            # Catégories secondaires
            cat_ids = data.get('category_ids', [])
            if cat_ids:
                business.categories.set(cat_ids)

            return Response({
                'message': 'Votre entreprise a été soumise avec succès. Elle est en attente de validation.',
                'business_id': business.id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MyBusinessSubscriptionView(APIView):
    """Statut d'abonnement SaaS de l'entreprise courante."""
    permission_classes = [IsAuthenticated]

    def _business(self, request):
        business = get_user_tenant_business(request.user)
        if not business and request.user.role == 'BUSINESS_OWNER':
            business = Business.objects.filter(owner=request.user).first()
        return business

    def get(self, request):
        business = self._business(request)
        if not business:
            return Response(
                {'detail': 'Aucune entreprise associée.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        ensure_business_subscription(business)
        payments = (
            SubscriptionPayment.objects.filter(business=business)
            .select_related('plan', 'subscription', 'initiated_by', 'business__owner')
            .order_by('-created_at')[:100]
        )
        data = subscription_summary(business)
        data['plans'] = list_paid_plans()
        data['burundipay_stub'] = burundipay.is_stub_mode()
        data['merchant_account'] = burundipay.merchant_account()
        data['recent_payments'] = [payment_detail_dict(p) for p in payments]
        data['payments_count'] = SubscriptionPayment.objects.filter(business=business).count()
        return Response(data)


class MyBusinessAuditLogsView(APIView):
    """
    Journal d'audit de l'entreprise courante (propriétaire / admin).
    Agrège accounts.AuditLog (+ HotelAuditLog pour les hôtels).
    """
    permission_classes = [IsAuthenticated, IsBusinessTenantMember]

    def get(self, request):
        from django.db.models import Q
        from accounts.models import AuditLog
        from accounts.serializers import AuditLogSerializer

        if request.user.role == 'SUPER_ADMIN':
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        business = get_user_tenant_business(request.user)
        if not business and request.user.role == 'BUSINESS_OWNER':
            business = Business.objects.filter(owner=request.user).first()
        if not business:
            return Response({'error': 'Aucune entreprise associée.'}, status=status.HTTP_400_BAD_REQUEST)

        # Réservé au propriétaire ou admin d'entreprise (pas tout le staff)
        is_owner = business.owner_id == request.user.id
        emp = BusinessEmployee.objects.filter(
            business=business, user=request.user, is_active=True,
        ).select_related('role').first()
        emp_admin = False
        if emp and emp.role_id:
            level = (getattr(emp.role, 'system_access_level', None) or '').upper()
            perms = list(getattr(emp.role, 'permissions', None) or [])
            emp_admin = (
                level in ('ADMIN_ACCESS', 'ADMIN')
                or 'audit.view' in perms
                or 'hotel.manage' in perms
                or 'can_manage_hospital' in perms
            )
        if not (is_owner or emp_admin or request.user.role == 'BUSINESS_OWNER'):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

        business_id = str(business.id)
        employee_ids = list(
            BusinessEmployee.objects.filter(business=business, is_active=True)
            .values_list('user_id', flat=True)
        )
        user_ids = set(employee_ids)
        if business.owner_id:
            user_ids.add(business.owner_id)

        queryset = AuditLog.objects.filter(
            Q(details__business_id=business_id)
            | Q(details__hospital_id=business_id)
            | Q(details__hotel_id=business_id)
            | Q(user_id__in=user_ids)
        ).select_related('user').order_by('-created_at')

        search = (request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(user_email__icontains=search)
                | Q(action__icontains=search)
                | Q(resource__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
            )

        action_filter = (request.query_params.get('action') or '').strip()
        if action_filter and action_filter != 'ALL':
            queryset = queryset.filter(action=action_filter)

        status_filter = (request.query_params.get('status') or '').strip().upper()
        if status_filter and status_filter != 'ALL':
            queryset = queryset.filter(status=status_filter)

        category = (request.query_params.get('category') or '').strip().upper()
        if category and category != 'ALL':
            if category == 'ACCESS':
                queryset = queryset.filter(
                    Q(action__icontains='LOGIN') | Q(action__icontains='LOGOUT')
                    | Q(action__icontains='PASSWORD') | Q(action__icontains='2FA')
                )
            elif category == 'SECURITY':
                queryset = queryset.filter(
                    Q(action__icontains='ROLE') | Q(action__icontains='PERMISSION')
                    | Q(action__icontains='RBAC') | Q(action__icontains='ADMIN')
                )
            elif category == 'BILLING':
                queryset = queryset.filter(
                    Q(action__icontains='PAY') | Q(action__icontains='BILLING')
                    | Q(action__icontains='SUBSCRIPTION') | Q(action__icontains='INVOICE')
                    | Q(action__icontains='MARK_PAID')
                )
            elif category == 'DATA_EXPORT':
                queryset = queryset.filter(
                    Q(action__icontains='EXPORT') | Q(action__icontains='DOWNLOAD')
                    | Q(action__icontains='CSV')
                )
            elif category == 'DATA_CHANGE':
                queryset = queryset.filter(
                    Q(action__icontains='CREATE') | Q(action__icontains='UPDATE')
                    | Q(action__icontains='DELETE') | Q(action__icontains='CONFIRM')
                    | Q(action__icontains='CANCEL') | Q(action__icontains='CHECK')
                )

        results = list(AuditLogSerializer(queryset[:200], many=True).data)

        # Hôtels : inclure le journal PMS dédié
        try:
            from datetime import timezone as dt_timezone
            from hotel.models import HotelAuditLog
            hotel_qs = HotelAuditLog.objects.filter(hotel=business).select_related('actor')
            if search:
                hotel_qs = hotel_qs.filter(
                    Q(action__icontains=search)
                    | Q(entity_type__icontains=search)
                    | Q(actor__email__icontains=search)
                )
            if action_filter and action_filter != 'ALL':
                hotel_qs = hotel_qs.filter(action=action_filter)
            # Hotel PMS n'a pas de statut natif : traité comme SUCCESS
            if status_filter and status_filter not in ('ALL', 'SUCCESS'):
                hotel_qs = hotel_qs.none()
            if category and category not in ('ALL', 'DATA_CHANGE', 'OTHER'):
                hotel_qs = hotel_qs.none()
            for log in hotel_qs[:200]:
                actor = log.actor
                created = log.created_at
                created_utc = None
                if created:
                    if timezone.is_naive(created):
                        created_aware = timezone.make_aware(created, dt_timezone.utc)
                    else:
                        created_aware = created
                    created_utc = created_aware.astimezone(dt_timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
                results.append({
                    'id': str(log.id),
                    'user': str(actor.id) if actor else None,
                    'user_id': str(actor.id) if actor else None,
                    'user_email': getattr(actor, 'email', None) or '',
                    'user_name': (
                        actor.get_full_name() if actor and hasattr(actor, 'get_full_name') else ''
                    ) or (getattr(actor, 'email', None) or 'Système'),
                    'user_role': getattr(actor, 'role', '') or 'STAFF',
                    'action': log.action,
                    'resource': f'{log.entity_type} {log.entity_id}'.strip(),
                    'ip_address': None,
                    'user_agent': '',
                    'status': 'SUCCESS',
                    'details': {
                        'source': 'hotel_pms',
                        'old_value': log.old_value,
                        'new_value': log.new_value,
                    },
                    'created_at': created.isoformat() if created else None,
                    'created_at_utc': created_utc,
                    'impersonation': None,
                    'changes': {'old': log.old_value, 'new': log.new_value},
                    'error_code': None,
                    'error_message': None,
                    'geo_location': None,
                    'event_category': 'DATA_CHANGE',
                })
        except Exception:
            pass

        results.sort(key=lambda x: x.get('created_at') or '', reverse=True)
        results = results[:200]
        return Response({
            'results': results,
            'count': len(results),
            'business_id': business_id,
            'business_name': business.name,
        })


class MySubscriptionBurundiPayPayView(APIView):
    """
    Initie un paiement BurundiPay d'abonnement : Entreprise → marchand Isoko Hub.
    Body: { "plan_code": "monthly", "payer_phone": "79xxxxxx" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business = get_user_tenant_business(request.user)
        if not business and request.user.role == 'BUSINESS_OWNER':
            business = Business.objects.filter(owner=request.user).first()
        if not business:
            return Response({'detail': 'Aucune entreprise associée.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user.role not in ('BUSINESS_OWNER', 'PROFESSIONAL') and not getattr(request.user, 'is_superuser', False):
            return Response({'detail': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

        # Abonnement plateforme = propriétaire uniquement (pas le Manager employé)
        if request.user.role == 'PROFESSIONAL' and business.owner_id != request.user.id:
            return Response(
                {'detail': 'Seul le propriétaire de l\'entreprise peut gérer l\'abonnement plateforme.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_or_create_default_plans()
        plan_code = (request.data.get('plan_code') or 'monthly').strip()
        payer_phone = (request.data.get('payer_phone') or '').strip()
        plan = SubscriptionPlan.objects.filter(code=plan_code, is_active=True, is_trial=False).first()
        if not plan:
            return Response({'detail': f'Plan payant inconnu: {plan_code}'}, status=status.HTTP_400_BAD_REQUEST)
        if not payer_phone:
            return Response({'detail': 'payer_phone (numéro BurundiPay) requis.'}, status=status.HTTP_400_BAD_REQUEST)

        ensure_business_subscription(business)
        payment = SubscriptionPayment.objects.create(
            business=business,
            subscription=getattr(business, 'subscription', None),
            plan=plan,
            amount_bif=plan.price_bif,
            payer_phone=burundipay.normalize_phone(payer_phone),
            status='PENDING',
            merchant_account=burundipay.merchant_account(),
            initiated_by=request.user,
            raw_request={
                'plan_code': plan.code,
                'payer_phone': payer_phone,
            },
        )

        result = burundipay.initiate_collection(
            amount_bif=payment.amount_bif,
            payer_phone=payment.payer_phone,
            external_id=str(payment.id),
            description=f'Abonnement Isoko Hub — {plan.name} — {business.name}',
        )
        payment.raw_response = result.get('raw') or {}
        payment.provider_reference = result.get('provider_reference') or ''
        if result.get('ok'):
            payment.status = result.get('status') or 'AWAITING_PIN'
            payment.error_message = ''
        else:
            payment.status = 'FAILED'
            payment.error_message = result.get('message') or 'Échec initiation BurundiPay'
        payment.save()

        return Response(
            {
                'payment_id': str(payment.id),
                'status': payment.status,
                'status_display': payment.get_status_display(),
                'amount_bif': payment.amount_bif,
                'payer_phone': payment.payer_phone,
                'provider_reference': payment.provider_reference,
                'merchant_account': payment.merchant_account,
                'message': result.get('message') or '',
                'stub_mode': burundipay.is_stub_mode(),
                'subscription': subscription_summary(business),
            },
            status=status.HTTP_201_CREATED if result.get('ok') else status.HTTP_400_BAD_REQUEST,
        )


class MySubscriptionBurundiPayConfirmView(APIView):
    """
    Confirme un paiement (simulation PIN en mode stub, ou polling statut).
    Body: { "payment_id": "..." }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business = get_user_tenant_business(request.user)
        if not business and request.user.role == 'BUSINESS_OWNER':
            business = Business.objects.filter(owner=request.user).first()
        if not business:
            return Response({'detail': 'Aucune entreprise associée.'}, status=status.HTTP_404_NOT_FOUND)

        payment_id = request.data.get('payment_id')
        payment = SubscriptionPayment.objects.filter(id=payment_id, business=business).select_related('plan').first()
        if not payment:
            return Response({'detail': 'Paiement introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if payment.status == 'SUCCESS':
            return Response({
                'payment_id': str(payment.id),
                'status': payment.status,
                'message': 'Paiement déjà confirmé.',
                'subscription': subscription_summary(business),
            })

        if payment.status not in ('PENDING', 'AWAITING_PIN'):
            return Response(
                {'detail': f'Paiement non confirmable (statut {payment.status}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not burundipay.is_stub_mode():
            # Live : polling statut auprès de BurundiPay
            poll = burundipay.check_collection_status(
                provider_reference=payment.provider_reference or '',
                external_id=str(payment.id),
            )
            payment.raw_response = {
                **(payment.raw_response or {}),
                'status_poll': poll.get('raw') or {},
            }
            if poll.get('provider_reference'):
                payment.provider_reference = poll['provider_reference']
            mapped = (poll.get('status') or '').upper()
            if mapped == 'PAID':
                with transaction.atomic():
                    activate_subscription_from_payment(payment)
                return Response({
                    'payment_id': str(payment.id),
                    'status': 'SUCCESS',
                    'message': 'Paiement confirmé via BurundiPay.',
                    'subscription': subscription_summary(business),
                })
            if mapped == 'FAILED':
                payment.status = 'FAILED'
                payment.error_message = poll.get('message') or 'Échec BurundiPay'
                payment.save(update_fields=[
                    'status', 'error_message', 'raw_response', 'provider_reference', 'updated_at',
                ])
                return Response({
                    'payment_id': str(payment.id),
                    'status': payment.status,
                    'message': payment.error_message,
                    'subscription': subscription_summary(business),
                }, status=status.HTTP_400_BAD_REQUEST)

            payment.status = 'AWAITING_PIN'
            payment.save(update_fields=[
                'status', 'raw_response', 'provider_reference', 'updated_at',
            ])
            return Response(
                {
                    'detail': (
                        poll.get('message')
                        or 'Paiement encore en attente. Le client doit valider sur BurundiPay, '
                           'ou attendez le webhook.'
                    ),
                    'payment_id': str(payment.id),
                    'status': payment.status,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Stub : simule validation PIN réussie → active l'abo
        with transaction.atomic():
            activate_subscription_from_payment(payment)

        return Response({
            'payment_id': str(payment.id),
            'status': 'SUCCESS',
            'message': 'Paiement simulé réussi. Abonnement activé.',
            'subscription': subscription_summary(business),
        })


class BurundiPaySubscriptionWebhookView(APIView):
    """
    Callback BurundiPay (production).
    Header: X-BurundiPay-Webhook-Secret
    Body: { "external_id" | "payment_id", "provider_reference", "status": "SUCCESS"|"FAILED"|..., ... }

    external_id :
      - UUID paiement abonnement SaaS
      - res-{reservation_id}
      - apt-{appointment_id}
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        # Fail-closed : un webhook sans secret est un webhook ouvert.
        # settings.py interdit le démarrage dans ce cas hors stub local ; ce
        # garde-fou couvre le cas d'un secret vidé à chaud (override, env hot-reload).
        expected = (getattr(settings, 'BURUNDIPAY_WEBHOOK_SECRET', '') or '').strip()
        if not expected:
            logger.error('Webhook BurundiPay refusé : BURUNDIPAY_WEBHOOK_SECRET non configuré.')
            return Response({'detail': 'Webhook non configuré.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        provided = (
            request.headers.get('X-BurundiPay-Webhook-Secret')
            or request.headers.get('X-Lumicash-Webhook-Secret')
            or ''
        ).strip()
        # compare_digest : évite de fuiter le préfixe du secret par canal temporel.
        if not hmac.compare_digest(provided, expected):
            logger.warning(
                'Webhook BurundiPay : secret invalide depuis %s (action=%s)',
                request.META.get('REMOTE_ADDR') or 'inconnu',
                str(request.data.get('external_id') or request.data.get('payment_id') or '?')[:64],
            )
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        payment_id = request.data.get('payment_id') or request.data.get('external_id')
        provider_ref = (request.data.get('provider_reference') or '').strip()
        event_status = (request.data.get('status') or '').strip().upper()
        external_raw = str(payment_id or '').strip()

        # Réservation hôtel
        if external_raw.startswith('res-'):
            return self._apply_hotel_reservation(external_raw[4:], provider_ref, event_status, request.data)
        # RDV hôpital
        if external_raw.startswith('apt-'):
            return self._apply_hospital_appointment(external_raw[4:], provider_ref, event_status, request.data)

        payment = None
        if payment_id:
            payment = SubscriptionPayment.objects.filter(id=payment_id).select_related('plan', 'business').first()
        if not payment and provider_ref:
            payment = SubscriptionPayment.objects.filter(
                provider_reference=provider_ref
            ).select_related('plan', 'business').first()

        if not payment:
            return Response({'detail': 'Paiement introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        payment.raw_response = {**(payment.raw_response or {}), 'webhook': dict(request.data)}
        if provider_ref and not payment.provider_reference:
            payment.provider_reference = provider_ref

        if event_status in ('SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED'):
            if payment.status != 'SUCCESS':
                with transaction.atomic():
                    activate_subscription_from_payment(payment)
            else:
                payment.save(update_fields=['raw_response', 'provider_reference', 'updated_at'])
            return Response({'ok': True, 'payment_status': 'SUCCESS'})

        if event_status in ('FAILED', 'CANCELLED', 'EXPIRED'):
            payment.status = 'FAILED' if event_status == 'FAILED' else event_status
            payment.error_message = request.data.get('message') or event_status
            payment.save(update_fields=['status', 'error_message', 'raw_response', 'provider_reference', 'updated_at'])
            return Response({'ok': True, 'payment_status': payment.status})

        payment.save(update_fields=['raw_response', 'provider_reference', 'updated_at'])
        return Response({'ok': True, 'payment_status': payment.status, 'note': 'Statut ignoré'})

    def _apply_hotel_reservation(self, reservation_id, provider_ref, event_status, payload):
        from hotel.models import Reservation
        res = Reservation.objects.filter(id=reservation_id).first()
        if not res:
            return Response({'detail': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        if provider_ref:
            res.payment_provider_reference = provider_ref
        if event_status in ('SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED'):
            if res.payment_status != 'PAID':
                res.payment_status = 'PAID'
                res.paid_at = timezone.now()
                res.payment_method = res.payment_method or 'BURUNDIPAY'
                res.payment_note = 'Confirmé via webhook BurundiPay'
            res.save(update_fields=[
                'payment_status', 'paid_at', 'payment_method', 'payment_note',
                'payment_provider_reference', 'updated_at',
            ])
            return Response({'ok': True, 'kind': 'reservation', 'payment_status': res.payment_status})
        if event_status in ('FAILED', 'CANCELLED', 'EXPIRED'):
            res.payment_status = 'FAILED'
            res.payment_note = (payload.get('message') or event_status)[:255]
            res.save(update_fields=[
                'payment_status', 'payment_note', 'payment_provider_reference', 'updated_at',
            ])
            return Response({'ok': True, 'kind': 'reservation', 'payment_status': res.payment_status})
        res.save(update_fields=['payment_provider_reference', 'updated_at'])
        return Response({'ok': True, 'kind': 'reservation', 'payment_status': res.payment_status})

    def _apply_hospital_appointment(self, appointment_id, provider_ref, event_status, payload):
        from hospital.models import Appointment
        apt = Appointment.objects.filter(id=appointment_id).first()
        if not apt:
            return Response({'detail': 'RDV introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        if provider_ref:
            apt.payment_provider_reference = provider_ref
        if event_status in ('SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED'):
            if apt.payment_status != 'PAID':
                apt.payment_status = 'PAID'
                apt.paid_at = timezone.now()
                apt.payment_method = apt.payment_method or 'BURUNDIPAY'
                apt.payment_note = 'Confirmé via webhook BurundiPay'
            apt.save(update_fields=[
                'payment_status', 'paid_at', 'payment_method', 'payment_note',
                'payment_provider_reference', 'updated_at',
            ])
            return Response({'ok': True, 'kind': 'appointment', 'payment_status': apt.payment_status})
        if event_status in ('FAILED', 'CANCELLED', 'EXPIRED'):
            apt.payment_status = 'FAILED'
            apt.payment_note = (payload.get('message') or event_status)[:255]
            apt.save(update_fields=[
                'payment_status', 'payment_note', 'payment_provider_reference', 'updated_at',
            ])
            return Response({'ok': True, 'kind': 'appointment', 'payment_status': apt.payment_status})
        apt.save(update_fields=['payment_provider_reference', 'updated_at'])
        return Response({'ok': True, 'kind': 'appointment', 'payment_status': apt.payment_status})


class AdminBusinessSubscriptionView(APIView):
    """
    Admin plateforme : consulter / activer / prolonger / suspendre l'abonnement.
    POST body: { "action": "activate"|"extend"|"suspend"|"free", "days": 30, "plan_code": "monthly", "payment_reference": "" }
    Alias accepté : action "trial" → free (rétrocompat).
    """
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': ('platform.billing.view', 'platform.subscriptions.view'),
        'POST': 'platform.businesses.suspend',
    }

    def get(self, request, pk):
        business = Business.objects.filter(pk=pk).first()
        if not business:
            return Response({'detail': 'Entreprise introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        ensure_business_subscription(business)
        return Response(subscription_summary(business))

    def post(self, request, pk):
        business = Business.objects.filter(pk=pk).first()
        if not business:
            return Response({'detail': 'Entreprise introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        get_or_create_default_plans()
        sub = ensure_business_subscription(business)
        action = (request.data.get('action') or 'activate').lower()
        if action == 'trial':
            action = 'free'
        days = int(request.data.get('days') or 30)
        plan_code = request.data.get('plan_code') or 'monthly'
        payment_ref = (request.data.get('payment_reference') or '').strip()
        notes = (request.data.get('notes') or '').strip()

        plan = SubscriptionPlan.objects.filter(code=plan_code, is_active=True).first()
        if not plan and action != 'suspend':
            return Response({'detail': f'Plan inconnu: {plan_code}'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if action == 'suspend':
            sub.status = 'SUSPENDED'
            if notes:
                sub.notes = notes
            sub.save()
        elif action == 'free':
            free = get_free_plan()
            sub.plan = free
            sub.status = 'TRIAL'
            sub.starts_at = now
            sub.ends_at = now + timedelta(days=days or free.duration_days)
            if payment_ref:
                sub.payment_reference = payment_ref
            if notes:
                sub.notes = notes
            else:
                sub.notes = 'Période Free accordée par Super Admin'
            reset_subscription_notices(sub)
            sub.save()
        elif action in ('activate', 'extend'):
            sub.plan = plan
            base = sub.ends_at if (action == 'extend' and sub.ends_at and sub.ends_at > now) else now
            sub.status = 'ACTIVE'
            sub.starts_at = now if action == 'activate' else sub.starts_at
            sub.ends_at = base + timedelta(days=days or plan.duration_days)
            if payment_ref:
                sub.payment_reference = payment_ref
            if notes:
                sub.notes = notes
            reset_subscription_notices(sub)
            sub.save()
        else:
            return Response(
                {'detail': 'action doit être activate, extend, suspend ou free'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(subscription_summary(business))


class AdminSubscriptionSettingsView(APIView):
    """
    Super Admin : période de grâce unique pour toutes les entreprises.
    GET / PATCH { "grace_period_days": 7 }
    """
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': 'platform.settings.view',
        'PATCH': 'platform.settings.update',
    }

    def get(self, request):
        return Response({
            'grace_period_days': get_grace_period_days(),
            'warning_days': EXPIRY_WARNING_DAYS,
            'note': (
                'La période de grâce s\'applique à toutes les entreprises. '
                f'Une alerte part {EXPIRY_WARNING_DAYS} jours avant l\'échéance, '
                'au Super Admin et à l\'administrateur de l\'entreprise. '
                'Après l\'échéance, le décompte de grâce avance chaque jour.'
            ),
        })

    def patch(self, request):
        if 'grace_period_days' not in request.data:
            return Response({'detail': 'grace_period_days requis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            row = update_grace_period_days(request.data.get('grace_period_days'))
        except (TypeError, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'grace_period_days': row.grace_period_days,
            'warning_days': EXPIRY_WARNING_DAYS,
        })


class AdminSubscriptionPlansView(APIView):
    """
    Super Admin : catalogue Free / Mensuel / Annuel.
    GET  — liste
    PATCH — body { "code": "free"|"monthly"|"yearly", ...champs }
    """
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': 'platform.settings.view',
        'PATCH': 'platform.settings.update',
    }

    def get(self, request):
        return Response({
            'results': list_all_catalog_plans(),
            'note': (
                'La durée Free s\'applique uniquement aux nouvelles inscriptions. '
                'Les prix Mensuel/Annuel s\'appliquent aux nouveaux paiements.'
            ),
        })

    def patch(self, request):
        code = (request.data.get('code') or '').strip()
        if not code:
            return Response({'detail': 'code requis (free, monthly, yearly).'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            plan = update_catalog_plan(code, request.data)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'plan': next(
                (p for p in list_all_catalog_plans() if p['code'] == plan.code),
                None,
            ),
            'results': list_all_catalog_plans(),
        })


class AdminSubscriptionPlanDetailView(APIView):
    """PATCH /admin/plans/<code>/ — alternative REST par code."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'PATCH': 'platform.settings.update'}

    def patch(self, request, code):
        try:
            plan = update_catalog_plan(code, request.data)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'plan': next(
                (p for p in list_all_catalog_plans() if p['code'] == plan.code),
                None,
            ),
            'results': list_all_catalog_plans(),
        })


class AdminSubscriptionListView(APIView):
    """
    Super Admin : liste des abonnements SaaS uniquement.
    Pas d'argent des commandes vendeur↔client.
    """
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': ('platform.billing.view', 'platform.subscriptions.view'),
    }

    def get(self, request):
        get_or_create_default_plans()
        businesses = (
            Business.objects.select_related(
                'subscription', 'subscription__plan', 'owner', 'primary_category'
            ).order_by('-created_at')
        )
        status_filter = (request.query_params.get('status') or '').strip().upper()
        results = []
        for biz in businesses:
            ensure_business_subscription(biz)
            summary = subscription_summary(biz)
            if status_filter:
                if status_filter == 'BLOCKED' and not summary['is_blocked']:
                    continue
                if status_filter == 'ACTIVE' and not summary['has_active_subscription']:
                    continue
                if status_filter not in ('BLOCKED', 'ACTIVE') and summary['status'] != status_filter:
                    continue
            results.append({
                'business_id': str(biz.id),
                'business_name': biz.name,
                'owner_email': getattr(biz.owner, 'email', None),
                'category': getattr(biz.primary_category, 'name', None),
                'is_active': biz.is_active,
                'verification_status': biz.verification_status,
                **summary,
            })

        active_count = sum(1 for r in results if r['has_active_subscription'])
        blocked_count = sum(1 for r in results if r['is_blocked'])
        return Response({
            'count': len(results),
            'active_count': active_count,
            'blocked_count': blocked_count,
            'note': (
                'Revenus plateforme = abonnements SaaS uniquement. '
                'Les montants des commandes restent privés (acheteur ↔ vendeur).'
            ),
            'results': results,
        })


class AdminSubscriptionPaymentListView(APIView):
    """Historique global des paiements d'abonnement SaaS (Super Admin)."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': ('platform.billing.view', 'platform.subscriptions.view'),
    }

    def get(self, request):
        qs = (
            SubscriptionPayment.objects.select_related(
                'business', 'business__owner', 'plan', 'subscription', 'initiated_by'
            ).order_by('-created_at')
        )
        status_filter = (request.query_params.get('status') or '').strip().upper()
        business_id = (request.query_params.get('business_id') or '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        if business_id:
            qs = qs.filter(business_id=business_id)

        limit = min(int(request.query_params.get('limit') or 100), 500)
        payments = list(qs[:limit])
        from django.db.models import Sum
        success_count = SubscriptionPayment.objects.filter(status='SUCCESS').count()
        total_bif = SubscriptionPayment.objects.filter(status='SUCCESS').aggregate(
            s=Sum('amount_bif')
        )['s'] or 0

        return Response({
            'count': len(payments),
            'success_count': success_count,
            'total_collected_bif': total_bif,
            'note': 'Paiements Entreprise → marchand Isoko Hub (historique conservé).',
            'results': [payment_detail_dict(p) for p in payments],
        })


class AdminPlatformNotificationListView(APIView):
    """Notifications Super Admin (paiements abo, etc.)."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': 'platform.alerts.view',
        'POST': 'platform.alerts.view',
    }

    def get(self, request):
        qs = PlatformNotification.objects.select_related('business', 'payment').order_by('-created_at')
        unread_only = request.query_params.get('unread') in ('1', 'true', 'True')
        if unread_only:
            qs = qs.filter(is_read=False)
        limit = min(int(request.query_params.get('limit') or 50), 200)
        items = list(qs[:limit])
        unread_count = PlatformNotification.objects.filter(is_read=False).count()
        return Response({
            'unread_count': unread_count,
            'count': len(items),
            'results': [
                {
                    'id': str(n.id),
                    'notification_type': n.notification_type,
                    'title': n.title,
                    'message': n.message,
                    'details': n.details or {},
                    'is_read': n.is_read,
                    'business_id': str(n.business_id) if n.business_id else None,
                    'business_name': n.business.name if n.business_id else None,
                    'payment_id': str(n.payment_id) if n.payment_id else None,
                    'created_at': n.created_at.isoformat() if n.created_at else None,
                }
                for n in items
            ],
        })

    def post(self, request):
        """Marquer comme lues : { "ids": [...], "all": true }"""
        mark_all = bool(request.data.get('all'))
        ids = request.data.get('ids') or []
        qs = PlatformNotification.objects.filter(is_read=False)
        if mark_all:
            updated = qs.update(is_read=True)
        elif ids:
            updated = qs.filter(id__in=ids).update(is_read=True)
        else:
            return Response({'detail': 'ids ou all requis.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'updated': updated, 'unread_count': PlatformNotification.objects.filter(is_read=False).count()})

