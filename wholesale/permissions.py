
from rest_framework.permissions import BasePermission
from businesses.tenant import get_user_tenant_business


class IsWholesaleAdmin(BasePermission):
    """Proprietaire d'une pharmacie de gros (tenant courant)."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == 'SUPER_ADMIN':
            return False
        business = get_user_tenant_business(user)
        if not business:
            return False
        return user.role == 'BUSINESS_OWNER' and business.owner_id == user.id


class IsRetailPharmacyClient(BasePermission):
    """Proprietaire d'une pharmacie de detail (client B2B)."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == 'SUPER_ADMIN':
            return False
        business = get_user_tenant_business(user)
        return bool(business and user.role == 'BUSINESS_OWNER')
