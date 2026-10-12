"""Isolation par établissement — même règle que l'hôpital et l'hôtel.

Un administrateur d'établissement ne lit et ne modifie que le sien. Le super
admin plateforme n'entre pas dans les listes métier : il supervise via la
modération entreprises.
"""

from django.shortcuts import get_object_or_404
from rest_framework.permissions import SAFE_METHODS, BasePermission

from business_categories.models import ModuleKey
from businesses.models import Business

from .permission_catalog import education_perm

EDUCATION_PARENT_SLUG = 'education'


def is_education_business(business):
    """L'établissement est-il rattaché au module Éducation ?

    Source de vérité : le champ `module` de la catégorie (cf. migration
    business_categories.0003 et suivantes). Le parent sert de filet quand la
    catégorie enfant n'a pas été revisitée.
    """
    if not business:
        return False
    category = getattr(business, 'primary_category', None)
    if not category:
        return False
    if category.module == ModuleKey.EDUCATION:
        return True
    parent = getattr(category, 'parent', None)
    return bool(parent and parent.module == ModuleKey.EDUCATION)


def education_business_ids(user):
    """Établissements Éducation auxquels l'utilisateur a accès (0 pour SUPER_ADMIN).

    On s'appuie sur `member_business_ids` (propriétés + emplois actifs) plutôt
    que sur `get_user_tenant_business` : celui-ci renvoie un seul
    établissement via `.first()` non trié, donc un propriétaire de plusieurs
    établissements verrait son module Éducation refusé selon l'ordre aléatoire
    de la base.
    """
    from businesses.payment_access import member_business_ids

    if not user or not user.is_authenticated:
        return []
    candidates = Business.objects.filter(
        id__in=member_business_ids(user)
    ).select_related('primary_category', 'primary_category__parent')
    return [b.id for b in candidates if is_education_business(b)]


def education_tenant_business(user):
    """L'établissement Éducation du tenant, ou None.

    Si plusieurs établissements Éducation sont rattachés au même compte, la
    création est refusée plutôt que de deviner : le payload ne porte pas encore
    d'identifiant d'établissement.
    """
    ids = education_business_ids(user)
    if len(ids) == 1:
        return Business.objects.filter(id=ids[0]).first()
    if not ids:
        return None
    from config.feature_flags import enabled
    if not enabled('EDUCATION_MULTI_TENANT_OWNER'):
        return None
    from .tenant_context import education_business_id
    chosen = education_business_id.get()
    if chosen and chosen in {str(item) for item in ids}:
        return Business.objects.filter(id=chosen).first()
    return None



def scope_to_education_tenant(user, queryset, lookup='business'):
    """Restreint un queryset Éducation au tenant de l'utilisateur."""
    if not user or not user.is_authenticated:
        return queryset.none()
    if getattr(user, 'role', None) == 'SUPER_ADMIN':
        return queryset.none()
    ids = education_business_ids(user)
    if not ids:
        return queryset.none()
    return queryset.filter(**{f'{lookup}__in': ids})


class IsEducationTenant(BasePermission):
    """Écriture réservée à l'établissement, lecture publique handled par la vue."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(education_business_ids(request.user))

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        business = getattr(obj, 'business', None)
        return education_perm(request.user, business, 'education.profile.update')


class EducationTenantOwnedMixin:
    """Écriture d'un objet : 404 si l'objet n'est pas dans le tenant.

    On filtre le queryset avant le `get_object_or_404` au lieu de lever un
    `PermissionDenied` : un 403 sur un id qui existe ailleurs permet d'énumérer
    les établissements des autres.
    """

    def owned_object(self, model, pk, lookup='business'):
        ids = education_business_ids(self.request.user)
        return get_object_or_404(
            model.objects.filter(**{f'{lookup}__in': ids}), pk=pk,
        )


class HasEducationPermission(BasePermission):
    """Permission fine par code, passée via `view.required_education_permission`."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        code = getattr(view, 'required_education_permission', None)
        if not code:
            return False
        return bool(education_business_ids(request.user)) and education_perm(
            request.user, education_tenant_business(request.user), code,
        )

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        code = getattr(view, 'required_education_permission', None)
        if not code:
            return False
        return education_perm(request.user, getattr(obj, 'business', None), code)
