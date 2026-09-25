from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.db.models import Q
from businesses.models import BusinessEmployee
from businesses.tenant import get_user_tenant_business
from .permission_catalog import expand_hotel_permissions, hotel_perm


def _emp_qs(user, **extra):
    return BusinessEmployee.objects.filter(user=user, is_active=True, **extra)


def _role_blob(user, business):
    emp = _emp_qs(user, business=business).select_related('role').first()
    if not emp:
        return '', [], ''
    name = (emp.role.name if emp.role else '') or ''
    perms = list(emp.role.permissions or []) if emp.role else []
    pos = (emp.position or '')
    return name.lower(), perms, pos.lower()


def user_hotel_business(user):
    if not user or not user.is_authenticated or getattr(user, 'role', None) == 'SUPER_ADMIN':
        return None
    return get_user_tenant_business(user)


def effective_hotel_permissions(user, hotel=None):
    """Ensemble de permissions hôtel effectives (legacy étendu + CRUD)."""
    if not user or not user.is_authenticated:
        return set()
    business = hotel or user_hotel_business(user)
    if not business:
        return set()
    is_owner = getattr(business, 'owner_id', None) == user.id
    if is_owner or getattr(user, 'role', None) == 'BUSINESS_OWNER':
        from .role_defaults import get_hotel_owner_role
        owner_role = get_hotel_owner_role(business) if is_owner else None
        perms = list(owner_role.permissions or []) if owner_role else []
        # Propriétaire réel de l’hôtel : toujours le plein PMS (évite 403 si rôle édité à tort)
        if is_owner and 'hotel.manage' not in perms:
            perms = list(dict.fromkeys([*perms, 'hotel.manage', 'hotel.owner']))
        if not perms:
            perms = ['hotel.manage', 'hotel.owner']
        return expand_hotel_permissions(perms)
    _, perms, _ = _role_blob(user, business)
    return expand_hotel_permissions(perms)


def has_hotel_perm(user, code, hotel=None):
    if not code:
        return False
    eff = effective_hotel_permissions(user, hotel)
    if 'hotel.manage' in eff or '*' in eff:
        return True
    return code in eff


def can_access_hotel_roles(user, hotel=None, action='view'):
    """
    Accès Rôles & Permissions via hotel.roles.* / hotel.manage
    (même règle pour propriétaire et employés).
    """
    if not user or not user.is_authenticated:
        return False
    if user.role == 'SUPER_ADMIN':
        return True
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    verb = action if action in ('view', 'create', 'update', 'delete') else 'view'
    return has_hotel_perm(user, hotel_perm('roles', verb), business)


def is_hotel_roles_manager(user, hotel=None):
    """Compat : toute personne autorisée à gérer les rôles."""
    return can_access_hotel_roles(user, hotel, 'view')


def is_hotel_admin(user, hotel=None):
    if not user or not user.is_authenticated or user.role == 'SUPER_ADMIN':
        return False
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    # Même règle pour owner et employés : hotel.manage (ou *)
    if has_hotel_perm(user, 'hotel.manage', business):
        return True
    return _emp_qs(user, business=business).filter(
        Q(position='ADMIN')
        | Q(role__system_access_level='ADMIN_ACCESS')
    ).exists()


def is_front_desk(user, hotel=None):
    if is_hotel_admin(user, hotel):
        return True
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    eff = effective_hotel_permissions(user, business)
    name, perms, pos = _role_blob(user, business)
    if (
        'hotel.front_desk' in eff
        or hotel_perm('stays', 'check_in') in eff
        or hotel_perm('stays', 'check_out') in eff
        or hotel_perm('stays', 'view') in eff
        or 'reception' in pos
        or 'réception' in name
        or 'reception' in name
    ):
        return True
    return _emp_qs(user, business=business).filter(
        Q(role__system_access_level='RECEPTIONIST_ACCESS')
        | Q(position__icontains='reception')
    ).exists()


def is_reservations_agent(user, hotel=None):
    if is_hotel_admin(user, hotel) or is_front_desk(user, hotel):
        return True
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    eff = effective_hotel_permissions(user, business)
    name, perms, pos = _role_blob(user, business)
    return (
        'hotel.reservations' in eff
        or hotel_perm('reservations', 'view') in eff
        or hotel_perm('reservations', 'create') in eff
        or hotel_perm('reservations', 'confirm') in eff
        or 'réserv' in name
        or 'reserv' in name
        or 'réserv' in pos
        or 'reserv' in pos
    )


def is_cashier(user, hotel=None):
    if is_hotel_admin(user, hotel):
        return True
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    eff = effective_hotel_permissions(user, business)
    name, perms, pos = _role_blob(user, business)
    if (
        'hotel.cashier' in eff
        or hotel_perm('cashier', 'view') in eff
        or 'caisse' in pos
        or 'cashier' in pos
        or 'caisse' in name
    ):
        return True
    return _emp_qs(user, business=business).filter(
        Q(role__system_access_level='CASHIER_ACCESS')
    ).exists()


def is_housekeeping_lead(user, hotel=None):
    if is_hotel_admin(user, hotel):
        return True
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    eff = effective_hotel_permissions(user, business)
    name, perms, pos = _role_blob(user, business)
    return (
        'hotel.housekeeping.lead' in eff
        or hotel_perm('housekeeping', 'assign') in eff
        or 'gouvern' in name
        or 'gouvern' in pos
        or ('responsable' in name and ('ménage' in name or 'house' in name))
    )


def is_housekeeping(user, hotel=None):
    if is_housekeeping_lead(user, hotel):
        return True
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    eff = effective_hotel_permissions(user, business)
    name, perms, pos = _role_blob(user, business)
    return (
        'hotel.housekeeping' in eff
        or hotel_perm('housekeeping', 'view') in eff
        or hotel_perm('housekeeping', 'update') in eff
        or 'housekeeping' in pos
        or 'ménage' in pos
        or 'menage' in pos
        or 'ménage' in name
        or 'menage' in name
        or 'housekeep' in name
    )


def is_maintenance(user, hotel=None):
    if is_hotel_admin(user, hotel):
        return True
    business = hotel or user_hotel_business(user)
    if not business:
        return False
    eff = effective_hotel_permissions(user, business)
    name, perms, pos = _role_blob(user, business)
    return (
        'hotel.maintenance' in eff
        or hotel_perm('maintenance', 'view') in eff
        or 'maintenance' in pos
        or 'maintenance' in name
    )


def is_platform_hotel_viewer(user):
    """Lecture liste hôtels plateforme (modération / ops / super admin)."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN' or getattr(user, 'is_superuser', False):
        return True
    from accounts.platform_access import user_has_any_platform_perm
    return user_has_any_platform_perm(user, (
        'platform.businesses.view',
        'platform.businesses.suspend',
        'platform.businesses.create',
        'platform.businesses.approve',
    ))


def can_platform_hotel_suspend(user):
    """Suspendre / réactiver un hôtel — droit suspend uniquement (pas analytics seul)."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN' or getattr(user, 'is_superuser', False):
        return True
    from accounts.platform_access import user_has_platform_perm
    return user_has_platform_perm(user, 'platform.businesses.suspend')


def can_platform_hotel_verify(user):
    """Vérifier classification / étoiles."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN' or getattr(user, 'is_superuser', False):
        return True
    from accounts.platform_access import user_has_any_platform_perm
    return user_has_any_platform_perm(user, (
        'platform.businesses.update',
        'platform.businesses.approve',
        'platform.businesses.suspend',
    ))


def is_platform_hotel_admin(user):
    """Compat : accès admin hôtels plateforme (lecture ou action)."""
    return is_platform_hotel_viewer(user)

class IsHotelTenant(BasePermission):
    def has_permission(self, request, view):
        return user_hotel_business(request.user) is not None


class IsHotelAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_hotel_admin(request.user)


class IsHotelRolesManager(BasePermission):
    """Rôles & Permissions — via hotel.roles.* (même règle pour tous)."""

    def has_permission(self, request, view):
        return can_access_hotel_roles(request.user)


class IsHotelStaff(BasePermission):
    """
    Accès PMS de base : permission hôtel effective (employé ou rôle Propriétaire),
    ou propriétaire du tenant (shell dashboard / lecture).
    Les CRUD restent contrôlés par HotelCrudPermission / has_hotel_perm.
    """

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        business = user_hotel_business(u)
        if not business:
            return False
        # Propriétaire du business hôtel : toujours accès au shell PMS
        if getattr(business, 'owner_id', None) == u.id:
            return True
        eff = effective_hotel_permissions(u, business)
        meaningful = {p for p in eff if p != 'hotel.owner'}
        if meaningful:
            return True
        return (
            is_hotel_admin(u, business)
            or is_front_desk(u, business)
            or is_reservations_agent(u, business)
            or is_cashier(u, business)
            or is_housekeeping(u, business)
            or is_maintenance(u, business)
        )


class HotelCrudPermission(BasePermission):
    """view.hotel_perm_resource = 'rates' | 'rooms' | …"""

    METHOD_ACTION = {
        'GET': 'view', 'HEAD': 'view', 'OPTIONS': 'view',
        'POST': 'create', 'PUT': 'update', 'PATCH': 'update', 'DELETE': 'delete',
    }

    def has_permission(self, request, view):
        resource = getattr(view, 'hotel_perm_resource', None)
        if not resource:
            return IsHotelStaff().has_permission(request, view)

        custom = getattr(view, 'hotel_perm_actions', None) or {}
        action_name = getattr(view, 'action', None)
        if action_name and action_name in custom:
            verb = custom[action_name]
        elif action_name in ('list', 'retrieve'):
            verb = 'view'
        elif action_name == 'create':
            verb = 'create'
        elif action_name in ('update', 'partial_update'):
            verb = 'update'
        elif action_name == 'destroy':
            verb = 'delete'
        else:
            verb = self.METHOD_ACTION.get(request.method, 'view')

        if verb == 'view':
            if has_hotel_perm(request.user, hotel_perm(resource, 'view')):
                return True
            # Référentiel types/tarifs : lecture si le rôle gère déjà réservations / chambres
            from .permission_catalog import REFERENCE_VIEW_BRIDGE
            bridges = REFERENCE_VIEW_BRIDGE.get(resource) or ()
            return any(has_hotel_perm(request.user, code) for code in bridges)
        return has_hotel_perm(request.user, hotel_perm(resource, verb))


class IsFrontDeskOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return IsHotelStaff().has_permission(request, view)
        return is_front_desk(request.user) or is_hotel_admin(request.user)


class IsReservationsOrFrontDesk(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return IsHotelStaff().has_permission(request, view)
        return (
            is_reservations_agent(request.user)
            or is_front_desk(request.user)
            or is_hotel_admin(request.user)
        )


class IsCashierOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return IsHotelStaff().has_permission(request, view)
        return is_cashier(request.user) or is_hotel_admin(request.user)


class IsHousekeepingStaff(BasePermission):
    def has_permission(self, request, view):
        return is_housekeeping(request.user) or is_hotel_admin(request.user)


class IsMaintenanceOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return (
                is_maintenance(request.user)
                or is_hotel_admin(request.user)
                or is_housekeeping_lead(request.user)
                or is_front_desk(request.user)
            )
        return is_maintenance(request.user) or is_hotel_admin(request.user)


class IsPlatformHotelAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_platform_hotel_admin(request.user)
