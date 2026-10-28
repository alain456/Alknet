"""Isolation par établissement pour le module Services."""
from rest_framework.permissions import BasePermission

from business_categories.models import ModuleKey
from businesses.models import Business
from businesses.payment_access import member_business_ids


def is_services_business(business):
    if not business:
        return False
    category = getattr(business, 'primary_category', None) or getattr(business, 'category', None)
    if not category:
        return False
    if getattr(category, 'module', '') == ModuleKey.SERVICES:
        return True
    parent = getattr(category, 'parent', None)
    return bool(parent and getattr(parent, 'module', '') == ModuleKey.SERVICES)


def services_business_ids(user):
    if not user or not user.is_authenticated:
        return []
    candidates = Business.objects.filter(
        id__in=member_business_ids(user),
    ).select_related('primary_category', 'primary_category__parent')
    return [row.id for row in candidates if is_services_business(row)]


def services_tenant_business(user):
    ids = services_business_ids(user)
    if not ids:
        return None
    return Business.objects.select_related(
        'primary_category', 'primary_category__parent', 'owner',
    ).filter(id=ids[0]).first()


class IsServicesProvider(BasePermission):
    def has_permission(self, request, view):
        return bool(services_tenant_business(request.user))
