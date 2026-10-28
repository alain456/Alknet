from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied

from business_categories.food_service import is_restaurant_business
from businesses.tenant import get_user_tenant_business


def user_restaurant_business(user):
    if not user or not user.is_authenticated or getattr(user, 'role', None) == 'SUPER_ADMIN':
        return None
    business = get_user_tenant_business(user)
    if not business or not is_restaurant_business(business):
        return None
    return business


def require_restaurant(request):
    business = user_restaurant_business(request.user)
    if not business:
        raise PermissionDenied('Aucun établissement de restauration rattaché.')
    return business


class IsRestaurantManager(BasePermission):
    def has_permission(self, request, view):
        return user_restaurant_business(request.user) is not None
