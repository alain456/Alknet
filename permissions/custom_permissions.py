from rest_framework import permissions

from businesses.tenant import get_user_tenant_business, user_is_business_tenant_member


class IsSuperAdmin(permissions.BasePermission):
    """Super administrateur plateforme uniquement."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role == 'SUPER_ADMIN' or bool(getattr(user, 'is_superuser', False))


class IsBusinessOwner(permissions.BasePermission):
    """Propriétaire d'entreprise uniquement (pas Super Admin)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'BUSINESS_OWNER'
        )


class IsProfessional(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'PROFESSIONAL'
        )


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'CUSTOMER'
        )


class IsBusinessTenantMember(permissions.BasePermission):
    """
    Membre d'une entreprise (owner ou employé actif).
    Exclut explicitement SUPER_ADMIN — il utilise les APIs /admin/.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'SUPER_ADMIN':
            return False
        return user_is_business_tenant_member(request.user)


class IsAdminOrBusinessOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ['SUPER_ADMIN', 'BUSINESS_OWNER']
        )


class IsAdminOrProfessional(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ['SUPER_ADMIN', 'PROFESSIONAL']
        )


class IsAdminOrBusinessOwnerOrProfessional(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ['SUPER_ADMIN', 'BUSINESS_OWNER', 'PROFESSIONAL']
        )


class IsBusinessOwnerOrStaff(permissions.BasePermission):
    """Owner ou employé actif — Super Admin exclu."""

    def has_permission(self, request, view):
        return IsBusinessTenantMember().has_permission(request, view)


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True

        if hasattr(obj, 'owner'):
            return obj.owner == request.user

        if hasattr(obj, 'user'):
            return obj.user == request.user

        if obj == request.user:
            return True

        return False


class IsBusinessMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True

        if hasattr(obj, 'owner') and obj.owner == request.user:
            return True

        if hasattr(obj, 'business'):
            from businesses.models import BusinessEmployee
            return BusinessEmployee.objects.filter(
                user=request.user,
                business=obj.business,
                is_active=True,
            ).exists()

        return False


class IsHospitalAdmin(permissions.BasePermission):
    """Administration hospitalière — Business Owner de l'établissement uniquement."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.role == 'SUPER_ADMIN':
            return False

        if request.user.role != 'BUSINESS_OWNER':
            return False

        business = get_user_tenant_business(request.user)
        if not business:
            return False

        cat = (business.primary_category.name if business.primary_category else '').lower()
        name = (business.name or '').lower()
        hospital_terms = ('hôpital', 'hopital', 'hospital', 'clinique', 'clinic', 'santé', 'sante', 'health')
        return any(t in cat or t in name for t in hospital_terms)
