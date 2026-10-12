from django.db.models import Q, Exists, OuterRef
from rest_framework import generics
from rest_framework.permissions import AllowAny

from permissions.custom_permissions import PlatformMethodPermission

from .models import BusinessCategory
from .serializers import BusinessCategorySerializer


class IsPlatformCatalogWrite(PlatformMethodPermission):
    """Lecture publique du référentiel ; écriture réservée à la plateforme.

    La catégorie pilote des décisions d'accès (pharmacies, hôtels) : elle ne
    doit pas être créable ni destructible depuis une session anonyme.
    """

    WRITE_PERMISSION = 'platform.catalog.update'

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        from accounts.platform_access import user_has_platform_perm
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user_has_platform_perm(user, self.WRITE_PERMISSION)


class BusinessCategoryListView(generics.ListAPIView):
    """
    Liste des catégories.
    Query params:
      - used=1 : uniquement les catégories déjà rattachées à au moins une entreprise active/vérifiée
      - parents_only=1 : uniquement les catégories racines (sans parent)
        (avec used=1 : inclut aussi les racines qui ont une sous-catégorie utilisée)
      - modules=a,b : avec parents_only, force l'affichage des racines de ces
        modules même sans entreprise rattachée. Un module avec sa propre vitrine
        publique (Éducation) ne doit pas disparaître de l'accueil parce qu'aucun
        établissement ne l'a encore rejoint.
    """
    serializer_class = BusinessCategorySerializer
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = BusinessCategory.objects.all().order_by('name')
        used = self.request.query_params.get('used', '').lower() in ('1', 'true', 'yes')
        parents_only = self.request.query_params.get('parents_only', '').lower() in ('1', 'true', 'yes')
        forced_modules = [
            m.strip() for m in self.request.query_params.get('modules', '').split(',')
            if m.strip()
        ]

        if used:
            from businesses.models import Business
            public_businesses = Business.objects.filter(
                is_active=True,
                is_verified=True,
            ).filter(
                Q(verification_status='APPROVED') | Q(verification_status='') | Q(verification_status__isnull=True)
            )
            linked = public_businesses.filter(
                Q(primary_category_id=OuterRef('pk'))
                | Q(category_id=OuterRef('pk'))
                | Q(categories__id=OuterRef('pk'))
            )
            if parents_only:
                # Racine utilisée directement, ou racine d’une sous-catégorie déjà utilisée
                child_linked = public_businesses.filter(
                    Q(primary_category_id=OuterRef('pk'))
                    | Q(category_id=OuterRef('pk'))
                    | Q(categories__id=OuterRef('pk'))
                )
                used_child_ids = BusinessCategory.objects.filter(
                    parent__isnull=False,
                ).filter(Exists(child_linked)).values_list('parent_id', flat=True)
                forced_ids = BusinessCategory.objects.filter(
                    parent__isnull=True, module__in=forced_modules,
                ).values_list('pk', flat=True) if forced_modules else None

                visible = Q(Exists(linked)) | Q(pk__in=used_child_ids)
                if forced_ids is not None:
                    visible |= Q(pk__in=forced_ids)
                qs = qs.filter(parent__isnull=True).filter(visible).distinct()
                return qs

            qs = qs.filter(Exists(linked)).distinct()

        if parents_only:
            qs = qs.filter(parent__isnull=True)

        return qs


class BusinessCategoryCreateView(generics.CreateAPIView):
    queryset = BusinessCategory.objects.all()
    serializer_class = BusinessCategorySerializer
    permission_classes = [IsPlatformCatalogWrite]


class BusinessCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BusinessCategory.objects.all()
    serializer_class = BusinessCategorySerializer
    permission_classes = [IsPlatformCatalogWrite]
