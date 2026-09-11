from rest_framework.permissions import BasePermission

class IsSuperAdmin(BasePermission):
    """
    Permet l'accès uniquement aux utilisateurs Super Admin.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return getattr(user, 'role', None) == 'SUPER_ADMIN' or bool(getattr(user, 'is_superuser', False))

class IsBusinessOwner(BasePermission):
    """
    Permet l'accès uniquement aux propriétaires d'entreprise.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'BUSINESS_OWNER')

class IsProfessional(BasePermission):
    """
    Permet l'accès uniquement aux professionnels indépendants.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'PROFESSIONAL')

