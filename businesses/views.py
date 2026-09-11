from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from datetime import timedelta
from django.utils import timezone
from django.conf import settings

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
)
from . import lumicash
from permissions.custom_permissions import IsSuperAdmin, IsBusinessOwner, IsBusinessTenantMember

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
        return queryset.select_related('primary_category', 'hospital_profile').prefetch_related('categories')

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
        ).select_related('primary_category', 'hospital_profile').prefetch_related('categories')


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
    permission_classes = [IsSuperAdmin]

class AdminBusinessDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Business.objects.all()
    serializer_class = AdminBusinessSerializer
    permission_classes = [IsSuperAdmin]

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
    permission_classes = [IsBusinessTenantMember]

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
    permission_classes = [IsBusinessTenantMember]

    def get_queryset(self):
        business = get_user_tenant_business(self.request.user)
        if business:
            return BusinessRole.objects.filter(business=business)
        return BusinessRole.objects.none()


class SeedReceptionistRoleView(APIView):
    """Crée ou met à jour le rôle standard « Agent d'accueil » avec ses permissions."""
    permission_classes = [IsBusinessTenantMember]

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
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'detail': 'Aucune entreprise associée à votre compte.'}, status=status.HTTP_400_BAD_REQUEST)

        email = request.data.get('email')
        position = request.data.get('position', 'STAFF')
        role_id = request.data.get('role_id')

        if not email:
            return Response({'email': 'L\'email est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            User = get_user_model()
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'email': 'Aucun utilisateur trouvé avec cet email.'}, status=status.HTTP_404_NOT_FOUND)

        if user.role == 'SUPER_ADMIN':
            return Response(
                {'email': 'Le super administrateur plateforme ne peut pas être ajouté au personnel d\'une entreprise.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if BusinessEmployee.objects.filter(business=business, user=user).exists():
            return Response({'detail': 'Cet utilisateur est déjà un employé.'}, status=status.HTTP_400_BAD_REQUEST)

        role = None
        if role_id:
            try:
                role = BusinessRole.objects.get(id=role_id, business=business)
            except BusinessRole.DoesNotExist:
                pass

        employee = BusinessEmployee.objects.create(business=business, user=user, position=position, role=role)
        serializer = self.get_serializer(employee)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
        instance = self.get_object()
        role_id = request.data.get('role_id')
        position = request.data.get('position')

        if position is not None:
            instance.position = position
        if role_id:
            try:
                role = BusinessRole.objects.get(id=role_id, business=instance.business)
                instance.role = role
            except BusinessRole.DoesNotExist:
                pass

        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

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
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@isokohub.bi'),
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
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@isokohub.bi'),
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
    permission_classes = [IsSuperAdmin]

class AdminModerationApproveView(APIView):
    """Approuve une entreprise (PENDING ou REJECTED) → Actif & Approuvé."""
    permission_classes = [IsSuperAdmin]

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
    permission_classes = [IsSuperAdmin]

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
        email = data.get('owner_email_input') or data.get('email')
        password = data.get('password')
        name = data.get('name')
        
        if not email or not password or not name:
            return Response({'error': 'Le nom de l\'entreprise, l\'email et le mot de passe sont obligatoires.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Vérification si le nom de l'entreprise existe déjà
        if Business.objects.filter(name__iexact=name).exists():
            return Response({'error': 'Une entreprise avec ce nom existe déjà.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Création ou récupération de l'utilisateur (Propriétaire)
        try:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'role': 'BUSINESS_OWNER',
                    'first_name': data.get('first_name', 'Admin'),
                    'last_name': data.get('last_name', name),
                    'is_active': True
                }
            )
            
            if created:
                user.set_password(password)
                user.save()
            else:
                # Si l'utilisateur existe déjà, on vérifie si le mot de passe correspond, sinon on refuse (sécurité basique)
                if not user.check_password(password):
                     return Response({'error': 'Un compte avec cet email existe déjà. Mot de passe incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

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

            # Gestion du Logo
            logo_data = data.get('logo')
            if logo_data and logo_data.startswith('http'):
                # Simple URL binding (If you are using CharField or similar for logo URL in the future)
                pass

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
        data['lumicash_stub'] = lumicash.is_stub_mode()
        data['merchant_account'] = lumicash.merchant_account()
        data['recent_payments'] = [payment_detail_dict(p) for p in payments]
        data['payments_count'] = SubscriptionPayment.objects.filter(business=business).count()
        return Response(data)


class MySubscriptionLumicashPayView(APIView):
    """
    Initie un paiement Lumicash d'abonnement : Entreprise → marchand Isoko Hub.
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

        # Seul le propriétaire (ou admin tenant) paie l'abo plateforme
        if request.user.role == 'PROFESSIONAL' and business.owner_id != request.user.id:
            emp = request.user.employments.filter(business=business, is_active=True).select_related('role').first()
            level = getattr(getattr(emp, 'role', None), 'system_access_level', '') if emp else ''
            if level != 'ADMIN_ACCESS':
                return Response(
                    {'detail': 'Seul le propriétaire ou un admin entreprise peut payer l\'abonnement.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        get_or_create_default_plans()
        plan_code = (request.data.get('plan_code') or 'monthly').strip()
        payer_phone = (request.data.get('payer_phone') or '').strip()
        plan = SubscriptionPlan.objects.filter(code=plan_code, is_active=True, is_trial=False).first()
        if not plan:
            return Response({'detail': f'Plan payant inconnu: {plan_code}'}, status=status.HTTP_400_BAD_REQUEST)
        if not payer_phone:
            return Response({'detail': 'payer_phone (numéro Lumicash) requis.'}, status=status.HTTP_400_BAD_REQUEST)

        ensure_business_subscription(business)
        payment = SubscriptionPayment.objects.create(
            business=business,
            subscription=getattr(business, 'subscription', None),
            plan=plan,
            amount_bif=plan.price_bif,
            payer_phone=lumicash.normalize_phone(payer_phone),
            status='PENDING',
            merchant_account=lumicash.merchant_account(),
            initiated_by=request.user,
            raw_request={
                'plan_code': plan.code,
                'payer_phone': payer_phone,
            },
        )

        result = lumicash.initiate_collection(
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
            payment.error_message = result.get('message') or 'Échec initiation Lumicash'
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
                'stub_mode': lumicash.is_stub_mode(),
                'subscription': subscription_summary(business),
            },
            status=status.HTTP_201_CREATED if result.get('ok') else status.HTTP_400_BAD_REQUEST,
        )


class MySubscriptionLumicashConfirmView(APIView):
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

        if not lumicash.is_stub_mode():
            return Response(
                {
                    'detail': (
                        'En mode live, la confirmation arrive via webhook Lumicash. '
                        'Rafraîchissez le statut dans quelques instants.'
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


class LumicashSubscriptionWebhookView(APIView):
    """
    Callback Lumicash (production) — active l'abonnement si SUCCESS.
    Header: X-Lumicash-Webhook-Secret
    Body: { "external_id" | "payment_id", "provider_reference", "status": "SUCCESS"|"FAILED", ... }
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        expected = getattr(settings, 'LUMICASH_WEBHOOK_SECRET', '') or ''
        provided = request.headers.get('X-Lumicash-Webhook-Secret', '')
        if expected and provided != expected:
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        payment_id = request.data.get('payment_id') or request.data.get('external_id')
        provider_ref = (request.data.get('provider_reference') or '').strip()
        event_status = (request.data.get('status') or '').strip().upper()

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


class AdminBusinessSubscriptionView(APIView):
    """
    Admin plateforme : consulter / activer / prolonger / suspendre l'abonnement.
    POST body: { "action": "activate"|"extend"|"suspend"|"free", "days": 30, "plan_code": "monthly", "payment_reference": "" }
    Alias accepté : action "trial" → free (rétrocompat).
    """
    permission_classes = [IsSuperAdmin]

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
            sub.save()
        else:
            return Response(
                {'detail': 'action doit être activate, extend, suspend ou free'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(subscription_summary(business))


class AdminSubscriptionPlansView(APIView):
    """
    Super Admin : catalogue Free / Mensuel / Annuel.
    GET  — liste
    PATCH — body { "code": "free"|"monthly"|"yearly", ...champs }
    """
    permission_classes = [IsSuperAdmin]

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
    permission_classes = [IsSuperAdmin]

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
    permission_classes = [IsSuperAdmin]

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
    permission_classes = [IsSuperAdmin]

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
    permission_classes = [IsSuperAdmin]

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

