"""Vues du module Éducation — P0 : annuaire public + gestion d'établissement.

Deux régimes de lecture, jamais mélangés :
  * public   : uniquement `publication_status=PUBLISHED` et abonnement SaaS actif ;
  * établissement : strictement le tenant, le super admin plateforme est exclu.
"""

from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.subscription import subscription_access_q

from .audit import audit_education
from .models import EducationProfile, EducationProgram, EducationUnit, PublicationStatus
from .throttling import EducationPublicThrottle
from .school_tracks import remember_school_tracks
from .permissions import (
    EducationTenantOwnedMixin,
    HasEducationPermission,
    IsEducationTenant,
    education_business_ids,
    education_tenant_business,
    scope_to_education_tenant,
)
from .permission_catalog import (
    ADMISSIONS_MANAGE,
    PROGRAMS_MANAGE,
    PROFILE_UPDATE,
    PROFILE_VIEW,
    STRUCTURE_MANAGE,
    education_perm,
)
from .rls import allow_write
from .serializers import (
    EducationProfileListSerializer,
    EducationProfileSerializer,
    EducationProfileWriteSerializer,
    EducationProgramSerializer,
    EducationProgramWriteSerializer,
    EducationUnitSerializer,
)


def require_education_tenant(user, request=None):
    """Établissement Éducation du tenant, sinon refus explicite.

    Un compte sans établissement Éducation — ou rattaché à plusieurs — ne peut
    pas créer de contenu : deviner l'établissement rendrait l'isolation
    silencieusement fausse.
    """
    business = education_tenant_business(user, request)
    if not business:
        raise PermissionDenied(
            "Aucun établissement Éducation unique n'est rattaché à ce compte."
        )
    return business


def _reject_foreign_unit(serializer, business):
    """Une formation ne peut pas être rattachée à la structure d'un autre."""
    unit = serializer.validated_data.get('unit')
    if unit and unit.business_id != getattr(business, 'id', None):
        raise ValidationError({'unit': 'Cette unité appartient à un autre établissement.'})


class EducationProfileViewSet(EducationTenantOwnedMixin, viewsets.ModelViewSet):
    """Fiche institutionnelle.

    GET public : uniquement les fiches publiées. GET staff : la sienne.
    """

    permission_classes = [AllowAny]
    required_education_permission = PROFILE_UPDATE

    def get_permissions(self):
        # Lecture : publique. `my_profile` reste accessible à tout membre de
        # l'établissement, il ne demande que le droit de lecture implicite.
        if self.action in ('list', 'retrieve', 'by_business', 'public_programs'):
            return [AllowAny()]
        if self.action == 'my_profile' and self.request.method in SAFE_METHODS:
            return [IsEducationTenant()]
        # Écriture : `education.profile.update` au niveau objet comme au niveau
        # requête. Avant, `create` passait par `IsEducationTenant` dont
        # `has_permission` se limitait à « l'utilisateur est membre » : un
        # employé sans droit d'écriture pouvait créer une fiche.
        return [HasEducationPermission()]

    def get_serializer_class(self):
        if self.action == 'list':
            return EducationProfileListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EducationProfileWriteSerializer
        return EducationProfileSerializer

    def get_queryset(self):
        queryset = EducationProfile.objects.select_related('business', 'business__primary_category')

        if self.action in ('list', 'retrieve', 'public_programs', 'by_business'):
            # Visiteur : publié + abonnement encore utilisable.
            queryset = queryset.filter(
                publication_status=PublicationStatus.PUBLISHED,
                business__is_active=True,
            ).filter(subscription_access_q('business__subscription__'))
            if self.request.query_params.get('category'):
                queryset = queryset.filter(
                    business__primary_category__slug=self.request.query_params['category']
                )
            track = (self.request.query_params.get('track') or '').strip()
            if track == 'prescolaire':
                queryset = queryset.filter(offers_prescolaire=True)
            elif track == 'ecofo':
                queryset = queryset.filter(offers_ecofo=True)
            elif track == 'post':
                queryset = queryset.filter(offers_post_fondamental=True)
            elif track == 'both':
                queryset = queryset.filter(offers_ecofo=True, offers_post_fondamental=True)
            if self.request.query_params.get('type'):
                queryset = queryset.filter(
                    establishment_type=self.request.query_params['type']
                )
            # University-specific filters
            if self.request.query_params.get('accreditation_level'):
                queryset = queryset.filter(
                    accreditation_level=self.request.query_params['accreditation_level']
                )
            if self.request.query_params.get('has_research_centers') == 'true':
                queryset = queryset.filter(has_research_centers=True)
            if self.request.query_params.get('founding_year_before'):
                try:
                    year = int(self.request.query_params['founding_year_before'])
                    queryset = queryset.filter(founding_year__lte=year)
                except ValueError:
                    pass
            if self.request.query_params.get('founding_year_after'):
                try:
                    year = int(self.request.query_params['founding_year_after'])
                    queryset = queryset.filter(founding_year__gte=year)
                except ValueError:
                    pass
            for param, field in (
                ('province', 'business__province'),
                ('commune', 'business__commune'),
                ('zone', 'business__zone'),
                ('quartier', 'business__quartier'),
            ):
                value = (self.request.query_params.get(param) or '').strip()
                if value:
                    queryset = queryset.filter(**{f'{field}__iexact': value})
            if self.request.query_params.get('q'):
                term = self.request.query_params['q'].strip()
                queryset = queryset.filter(
                    Q(business__name__icontains=term)
                    | Q(short_description__icontains=term)
                    | Q(official_name__icontains=term)
                )
            return queryset

        # Écriture et lecture staff : le tenant, jamais le super admin.
        return scope_to_education_tenant(self.request.user, queryset)

    def _tenant_profile(self):
        ids = education_business_ids(self.request.user)
        if not ids:
            return None
        return EducationProfile.objects.filter(business_id__in=ids).first()

    def perform_create(self, serializer):
        profile = serializer.save(
            business=require_education_tenant(self.request.user, self.request),
            publication_status=PublicationStatus.DRAFT,
        )
        audit_education(
            'EDUCATION_PROFILE_CREATE', profile.business,
            f'education.profile:{profile.pk}', user=self.request.user, request=self.request,
        )

    def perform_update(self, serializer):
        serializer.save()
        audit_education(
            'EDUCATION_PROFILE_UPDATE', serializer.instance.business,
            f'education.profile:{serializer.instance.pk}', user=self.request.user, request=self.request,
        )

    def get_object(self):
        """Accepte l'id de la fiche ou l'id Business, sans requête 404 intermédiaire."""
        queryset = self.filter_queryset(self.get_queryset())
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        obj = queryset.filter(pk=lookup).first() or queryset.filter(business_id=lookup).first()
        if obj is None:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj

    def _assert_own(self, pk):
        return self.owned_object(EducationProfile, pk)

    def update(self, request, *args, **kwargs):
        self._assert_own(kwargs.get('pk'))
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        profile = self._assert_own(kwargs.get('pk'))
        audit_education(
            'EDUCATION_PROFILE_DELETE', profile.business,
            f'education.profile:{profile.pk}', user=request.user, request=request,
        )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='by-business/(?P<business_id>[^/.]+)')
    def by_business(self, request, business_id=None):
        """Fiche publique résolue depuis l'id `Business`.

        Les fiches de toutes les autres catégories sont adressées par
        `business.id` (hôtels, hôpitaux, commerces). Sans cette action, un
        clic depuis la liste générale des entreprises ne peut pas mener à la
        page Éducation. Même garde-fou public : 404 si non publié.
        """
        profile = self.get_queryset().filter(business_id=business_id).first()
        if not profile:
            return Response(
                {'detail': 'Établissement non disponible publiquement.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(EducationProfileSerializer(profile).data)

    @action(detail=True, methods=['get'])
    def public_programs(self, request, pk=None):
        """Formations publiées de l'établissement — visible sans compte."""
        profile = self.get_object()
        programs = profile.business.education_programs.filter(
            is_active=True, is_public=True,
        ).select_related('unit', 'unit__parent').prefetch_related('fees', 'campaigns')
        return Response(EducationProgramSerializer(programs, many=True).data)

    @action(detail=False, methods=['get', 'patch', 'put'])
    def my_profile(self, request):
        """Fiche de l'établissement connecté, même en brouillon.

        Point d'entrée unique du tableau de bord : le client n'a pas à connaître
        son propre id, et l'écriture reste vérifiée par `_assert_own`.
        """
        profile = self._tenant_profile()
        if not profile:
            return Response(
                {'detail': "Aucune fiche Éducation pour cet établissement."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if request.method in ('PATCH', 'PUT'):
            self._assert_own(profile.id)
            if not education_perm(request.user, profile.business, PROFILE_UPDATE):
                raise PermissionDenied(
                    "Vous n'avez pas le droit de modifier la fiche de l'établissement."
                )
            serializer = EducationProfileWriteSerializer(
                profile, data=request.data, partial=request.method == 'PATCH',
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            profile.refresh_from_db()
            if {
                'offers_prescolaire', 'offers_ecofo', 'offers_post_fondamental',
                'ecofo_cycles', 'ecofo_classes', 'post_fondamental_sections',
            }.intersection(request.data):
                remember_school_tracks(profile)
            return Response(EducationProfileSerializer(profile).data)
        return Response(EducationProfileSerializer(profile).data)

    @action(detail=False, methods=['get', 'patch'], url_path='message-settings')
    def message_settings(self, request):
        """Messages école : dossier enregistré, refus, confirmation."""
        profile = self._tenant_profile()
        if not profile:
            return Response(
                {'detail': "Aucune fiche Éducation pour cet établissement."},
                status=status.HTTP_404_NOT_FOUND,
            )
        from .enrollment import ENROLLMENT_MESSAGE_PLACEHOLDERS, message_defaults
        if request.method == 'PATCH':
            self._assert_own(profile.id)
            if not education_perm(request.user, profile.business, PROFILE_UPDATE):
                raise PermissionDenied(
                    "Vous n'avez pas le droit de modifier la fiche de l'établissement."
                )
            mapping = {
                'received_message': 'enrollment_received_message',
                'refusal_message': 'enrollment_refusal_message',
                'accepted_message': 'enrollment_accepted_message',
            }
            update_fields = ['updated_at']
            for key, field in mapping.items():
                if key in request.data:
                    setattr(profile, field, str(request.data.get(key) or ''))
                    update_fields.append(field)
            profile.save(update_fields=update_fields)
        defaults = message_defaults(profile.business)
        audience = getattr(getattr(profile.business, 'primary_category', None), 'slug', '')
        return Response({
            'received_message': profile.enrollment_received_message or '',
            'refusal_message': profile.enrollment_refusal_message or '',
            'accepted_message': profile.enrollment_accepted_message or '',
            'default_received_message': defaults['received'],
            'default_refusal_message': defaults['refusal'],
            'default_accepted_message': defaults['accepted'],
            'placeholders': ENROLLMENT_MESSAGE_PLACEHOLDERS,
            'audience': audience,
        })

    @action(detail=False, methods=['post'], url_path='submit-for-review')
    def submit_for_review(self, request):
        profile = self._tenant_profile()
        if not profile:
            return Response({'detail': 'Fiche introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        profile.submitted_at = timezone.now()
        profile.publication_status = PublicationStatus.SUBMITTED
        profile.save(update_fields=['submitted_at', 'publication_status', 'updated_at'])
        return Response(EducationProfileSerializer(profile).data)


class EducationUnitViewSet(EducationTenantOwnedMixin, viewsets.ModelViewSet):
    """Facultés et départements — P1."""

    serializer_class = EducationUnitSerializer
    permission_classes = [AllowAny]
    required_education_permission = STRUCTURE_MANAGE

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [HasEducationPermission()]

    def get_queryset(self):
        from .scope import faculty_scope_for_user, restrict_units
        queryset = EducationUnit.objects.select_related('business', 'parent')
        if self.request.query_params.get('mine') == '1' and getattr(self.request.user, 'is_authenticated', False):
            if education_business_ids(self.request.user):
                return restrict_units(
                    scope_to_education_tenant(self.request.user, queryset),
                    faculty_scope_for_user(self.request.user),
                )
        if self.action in ('list', 'retrieve'):
            published = EducationProfile.objects.filter(
                publication_status=PublicationStatus.PUBLISHED,
            ).values_list('business_id', flat=True)
            queryset = queryset.filter(
                business_id__in=published, business__is_active=True,
                is_active=True,
            ).filter(subscription_access_q('business__subscription__'))
            if self.request.query_params.get('business'):
                queryset = queryset.filter(business_id=self.request.query_params['business'])
            return queryset
        return restrict_units(
            scope_to_education_tenant(self.request.user, queryset),
            faculty_scope_for_user(self.request.user),
        )

    def perform_create(self, serializer):
        business = require_education_tenant(self.request.user)
        parent = serializer.validated_data.get('parent')
        if parent and parent.business_id != business.id:
            raise ValidationError({'parent': 'Cette unité appartient à un autre établissement.'})
        allow_write(business.id)
        unit = serializer.save(business=business)
        audit_education(
            'EDUCATION_UNIT_CREATE', unit.business, f'education.unit:{unit.pk}',
            user=self.request.user, request=self.request, name=unit.name,
        )

    def perform_update(self, serializer):
        parent = serializer.validated_data.get('parent', serializer.instance.parent)
        if parent and parent.business_id != serializer.instance.business_id:
            raise ValidationError({'parent': 'Cette unité appartient à un autre établissement.'})
        allow_write(serializer.instance.business_id)
        serializer.save()
        audit_education(
            'EDUCATION_UNIT_UPDATE', serializer.instance.business,
            f'education.unit:{serializer.instance.pk}', user=self.request.user, request=self.request,
        )

    def _assert_own(self, pk):
        return self.owned_object(EducationUnit, pk)

    def update(self, request, *args, **kwargs):
        self._assert_own(kwargs.get('pk'))
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        unit = self._assert_own(kwargs.get('pk'))
        audit_education(
            'EDUCATION_UNIT_DELETE', unit.business, f'education.unit:{unit.pk}',
            user=request.user, request=request,
        )
        return super().destroy(request, *args, **kwargs)


def public_programs_queryset(params):
    """Formations visibles : fiche publiée, formation publique et active."""
    published = EducationProfile.objects.filter(
        publication_status=PublicationStatus.PUBLISHED,
        business__is_active=True,
    ).values_list('business_id', flat=True)
    queryset = (
        EducationProgram.objects.filter(
            business_id__in=published, is_active=True, is_public=True,
        )
        .filter(subscription_access_q('business__subscription__'))
        .select_related('business', 'unit', 'unit__parent')
        .prefetch_related('fees', 'campaigns')
    )
    q = (params.get('q') or '').strip()
    if q:
        queryset = queryset.filter(
            Q(title__icontains=q)
            | Q(domain__icontains=q)
            | Q(degree_awarded__icontains=q)
            | Q(business__name__icontains=q)
            | Q(unit__name__icontains=q)
            | Q(unit__parent__name__icontains=q)
        )
    faculty = (params.get('faculty') or '').strip()
    if faculty:
        queryset = queryset.filter(
            Q(unit__name__iexact=faculty) | Q(unit__parent__name__iexact=faculty)
        )
    domain = (params.get('domain') or '').strip()
    if domain:
        queryset = queryset.filter(domain__iexact=domain)
    level = (params.get('level') or '').strip()
    if level:
        queryset = queryset.filter(level=level)
    for param, field in (
        ('province', 'business__province'),
        ('commune', 'business__commune'),
    ):
        value = (params.get(param) or '').strip()
        if value:
            queryset = queryset.filter(**{f'{field}__iexact': value})
    business = (params.get('business') or '').strip()
    if business:
        queryset = queryset.filter(business_id=business)
    return queryset


class EducationProgramViewSet(EducationTenantOwnedMixin, viewsets.ModelViewSet):
    """Formations. GET public : uniquement celles marquées publiques."""

    permission_classes = [AllowAny]
    required_education_permission = PROGRAMS_MANAGE

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'facets'):
            return [AllowAny()]
        return [HasEducationPermission()]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return EducationProgramWriteSerializer
        return EducationProgramSerializer

    def get_queryset(self):
        if self.action in ('list', 'retrieve') and self.request.query_params.get('mine') == '1':
            if self.request.user.is_authenticated and education_business_ids(self.request.user):
                from .scope import faculty_scope_for_user, restrict_programs
                queryset = scope_to_education_tenant(
                    self.request.user,
                    EducationProgram.objects.select_related(
                        'business', 'unit', 'unit__parent',
                    ).prefetch_related('fees', 'campaigns'),
                )
                return restrict_programs(queryset, faculty_scope_for_user(self.request.user))
        if self.action in ('list', 'retrieve'):
            return public_programs_queryset(self.request.query_params)
        from .scope import faculty_scope_for_user, restrict_programs
        return restrict_programs(
            scope_to_education_tenant(
                self.request.user,
                EducationProgram.objects.select_related('business', 'unit', 'unit__parent'),
            ),
            faculty_scope_for_user(self.request.user),
        )

    @action(detail=False, methods=['get'])
    def facets(self, request):
        """Domaines, niveaux et facultés réellement publiés."""
        queryset = public_programs_queryset({
            'province': request.query_params.get('province', ''),
            'commune': request.query_params.get('commune', ''),
        })
        domains = sorted({
            name for name in queryset.exclude(domain='').values_list('domain', flat=True) if name
        })
        level_labels = dict(EducationProgram.LEVEL_CHOICES)
        levels = [
            {'value': value, 'label': level_labels.get(value, value)}
            for value in sorted({v for v in queryset.values_list('level', flat=True) if v})
        ]
        degree_type_labels = dict(EducationProgram.DEGREE_TYPE_CHOICES)
        degree_types = [
            {'value': value, 'label': degree_type_labels.get(value, value)}
            for value in sorted({v for v in queryset.values_list('degree_type', flat=True) if v})
        ]
        selectivity_labels = dict(EducationProgram.ADMISSION_SELECTIVITY_CHOICES)
        selectivities = [
            {'value': value, 'label': selectivity_labels.get(value, value)}
            for value in sorted({v for v in queryset.values_list('admission_selectivity', flat=True) if v})
        ]
        languages = sorted({
            lang.strip()
            for langs in queryset.exclude(language_of_instruction='').values_list('language_of_instruction', flat=True)
            for lang in langs.split(',')
            if lang.strip()
        })
        faculties = sorted({
            parent or name
            for name, parent in queryset.exclude(unit=None).values_list('unit__name', 'unit__parent__name')
            if parent or name
        })
        return Response({
            'domains': domains,
            'levels': levels,
            'degree_types': degree_types,
            'admission_selectivities': selectivities,
            'languages': languages,
            'faculties': faculties,
        })

    def perform_create(self, serializer):
        business = require_education_tenant(self.request.user)
        _reject_foreign_unit(serializer, business)
        allow_write(business.id)
        program = serializer.save(business=business)
        audit_education(
            'EDUCATION_PROGRAM_CREATE', program.business, f'education.program:{program.pk}',
            user=self.request.user, request=self.request, title=program.title,
        )

    def perform_update(self, serializer):
        _reject_foreign_unit(serializer, serializer.instance.business)
        allow_write(serializer.instance.business_id)
        serializer.save()
        audit_education(
            'EDUCATION_PROGRAM_UPDATE', serializer.instance.business,
            f'education.program:{serializer.instance.pk}', user=self.request.user, request=self.request,
        )

    def _assert_own(self, pk):
        return self.owned_object(EducationProgram, pk)

    def update(self, request, *args, **kwargs):
        self._assert_own(kwargs.get('pk'))
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        program = self._assert_own(kwargs.get('pk'))
        audit_education(
            'EDUCATION_PROGRAM_DELETE', program.business, f'education.program:{program.pk}',
            user=request.user, request=request,
        )
        return super().destroy(request, *args, **kwargs)


class EducationDistanceView(APIView):
    """Distance routière entre la position du visiteur et le GPS de l'école."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [EducationPublicThrottle]

    def get(self, request):
        from .geo import road_distance

        try:
            origin_lat = float(request.query_params['from_lat'])
            origin_lon = float(request.query_params['from_lng'])
            target_lat = float(request.query_params['to_lat'])
            target_lon = float(request.query_params['to_lng'])
        except (KeyError, TypeError, ValueError):
            return Response(
                {'detail': 'Coordonnées GPS incomplètes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (-90 <= origin_lat <= 90 and -90 <= target_lat <= 90):
            return Response({'detail': 'Latitude invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        if not (-180 <= origin_lon <= 180 and -180 <= target_lon <= 180):
            return Response({'detail': 'Longitude invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = road_distance(origin_lat, origin_lon, target_lat, target_lon)
        except Exception:
            return Response(
                {'detail': 'La distance routière est indisponible pour le moment.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(payload)
