"""Périmètre faculté pour un employé d'université."""
from django.db.models import Q


def faculty_scope_id(user, business):
    """None si l'utilisateur voit tout l'établissement."""
    if not user or not getattr(user, 'is_authenticated', False) or not business:
        return None
    if getattr(business, 'owner_id', None) == getattr(user, 'id', None):
        return None
    from businesses.models import BusinessEmployee
    employee = BusinessEmployee.objects.filter(
        user=user, business=business, is_active=True,
    ).only('education_scope_unit').first()
    if not employee:
        return None
    return employee.education_scope_unit


def faculty_scope_for_user(user):
    from .permissions import education_tenant_business
    business = education_tenant_business(user)
    return faculty_scope_id(user, business)


def restrict_programs(queryset, unit_id):
    if not unit_id:
        return queryset
    return queryset.filter(Q(unit_id=unit_id) | Q(unit__parent_id=unit_id))


def restrict_units(queryset, unit_id):
    if not unit_id:
        return queryset
    return queryset.filter(Q(pk=unit_id) | Q(parent_id=unit_id))


def restrict_applications(queryset, unit_id):
    if not unit_id:
        return queryset
    return queryset.filter(
        Q(campaign__program__unit_id=unit_id)
        | Q(campaign__program__unit__parent_id=unit_id)
    )
