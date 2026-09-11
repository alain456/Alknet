"""
Utilitaires multi-tenant — isolation stricte entre Super Admin et entreprises.
Le Super Admin n'accède pas aux APIs « my-business » / personnel d'une entreprise.
"""
from django.contrib.auth import get_user_model

User = get_user_model()


def get_user_tenant_business(user):
    """
    Retourne l'entreprise de travail de l'utilisateur (owner ou employé actif).
    Retourne None pour SUPER_ADMIN et CUSTOMER sans rattachement.
    """
    if not user or not user.is_authenticated:
        return None

    if user.role == 'SUPER_ADMIN':
        return None

    if user.role == 'BUSINESS_OWNER':
        return user.businesses.first()

    # Professionnels, employés hôpital/pharmacie, etc.
    owned = getattr(user, 'businesses', None)
    if owned is not None:
        first_owned = owned.first()
        if first_owned:
            return first_owned

    if user.role == 'PROFESSIONAL':
        if hasattr(user, 'doctor_profile') and user.doctor_profile and user.doctor_profile.hospital_id:
            return user.doctor_profile.hospital

    employment = user.employments.filter(is_active=True).select_related('business').first()
    if employment:
        return employment.business

    return None


def user_is_business_tenant_member(user):
    """True si l'utilisateur appartient à une entreprise (pas Super Admin plateforme)."""
    return get_user_tenant_business(user) is not None


def filter_queryset_by_hospital_tenant(user, queryset, hospital_lookup='hospital'):
    """
    Limite un queryset hospitalier au tenant de l'utilisateur.
    SUPER_ADMIN : aucun accès (APIs plateforme /admin/ uniquement).
    """
    if not user or not user.is_authenticated:
        return queryset.none()
    if user.role == 'SUPER_ADMIN':
        return queryset.none()
    if user.role == 'BUSINESS_OWNER':
        return queryset.filter(**{f'{hospital_lookup}__owner': user})
    business = get_user_tenant_business(user)
    if business:
        return queryset.filter(**{hospital_lookup: business})
    return queryset.filter(**{f'{hospital_lookup}__employees__user': user})
