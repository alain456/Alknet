from rest_framework.permissions import BasePermission

class IsSuperAdmin(BasePermission):
    """
    Permet l'accès uniquement aux utilisateurs Super Admin.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'SUPER_ADMIN')

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

