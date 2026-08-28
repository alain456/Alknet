from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    """
    Permission pour vérifier si l'utilisateur est un SUPER_ADMIN
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'SUPER_ADMIN'
        )


class IsBusinessOwner(permissions.BasePermission):
    """
    Permission pour vérifier si l'utilisateur est un BUSINESS_OWNER
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'BUSINESS_OWNER'
        )


class IsProfessional(permissions.BasePermission):
    """
    Permission pour vérifier si l'utilisateur est un PROFESSIONAL
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'PROFESSIONAL'
        )


class IsCustomer(permissions.BasePermission):
    """
    Permission pour vérifier si l'utilisateur est un CUSTOMER
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'CUSTOMER'
        )


class IsAdminOrBusinessOwner(permissions.BasePermission):
    """
    Permission pour SUPER_ADMIN ou BUSINESS_OWNER
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['SUPER_ADMIN', 'BUSINESS_OWNER']
        )


class IsAdminOrProfessional(permissions.BasePermission):
    """
    Permission pour SUPER_ADMIN ou PROFESSIONAL
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['SUPER_ADMIN', 'PROFESSIONAL']
        )


class IsAdminOrBusinessOwnerOrProfessional(permissions.BasePermission):
    """
    Permission pour SUPER_ADMIN, BUSINESS_OWNER ou PROFESSIONAL
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['SUPER_ADMIN', 'BUSINESS_OWNER', 'PROFESSIONAL']
        )


class IsBusinessOwnerOrStaff(permissions.BasePermission):
    """
    Permission pour BUSINESS_OWNER ou employé d'une entreprise
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role == 'SUPER_ADMIN':
            return True
        
        if request.user.role == 'BUSINESS_OWNER':
            return True
        
        # Vérifier si l'utilisateur est employé d'une entreprise
        if hasattr(request.user, 'business_employees'):
            return request.user.business_employees.filter(is_active=True).exists()
        
        return False


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission pour l'owner de la ressource ou un admin
    À utiliser avec object-level permissions
    """
    def has_object_permission(self, request, view, obj):
        # Les admins ont accès à tout
        if request.user.role == 'SUPER_ADMIN':
            return True
        
        # Vérifier si l'utilisateur est le propriétaire
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        
        # Vérifier si l'utilisateur est l'utilisateur lui-même
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        # Pour les objets liés directement à l'utilisateur
        if obj == request.user:
            return True
        
        return False


class IsBusinessMember(permissions.BasePermission):
    """
    Permission pour les membres d'une entreprise (owner ou employé)
    Pour les opérations sur les ressources d'une entreprise spécifique
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True
        
        # Vérifier si l'utilisateur est le propriétaire de l'entreprise
        if hasattr(obj, 'owner') and obj.owner == request.user:
            return True
        
        # Vérifier si l'utilisateur est employé de l'entreprise
        if hasattr(obj, 'business'):
            from businesses.models import BusinessEmployee
            return BusinessEmployee.objects.filter(
                user=request.user,
                business=obj.business,
                is_active=True
            ).exists()
        
        return False


class IsHospitalAdmin(permissions.BasePermission):
    """
    Permission spécifique pour l'administration hospitalière
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role == 'SUPER_ADMIN':
            return True
        
        # Vérifier si l'utilisateur est owner d'un hôpital
        if request.user.role == 'BUSINESS_OWNER':
            from businesses.models import Business, BusinessEmployee
            # Vérifier si l'utilisateur possède ou travaille dans un hôpital
            has_hospital = Business.objects.filter(
                owner=request.user,
                primary_category__name__icontains='hôpital'
            ).exists()
            
            if has_hospital:
                return True
            
            # Vérifier si employé d'un hôpital
            is_hospital_employee = BusinessEmployee.objects.filter(
                user=request.user,
                business__primary_category__name__icontains='hôpital',
                is_active=True
            ).exists()
            
            return is_hospital_employee
        
        return False
