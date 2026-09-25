"""Rôles hôtel pré-définis (PMS) — seed à la création / bouton admin."""

from .permission_catalog import _codes_for, ALL_HOTEL_CRUD

OWNER_ROLE_NAME = 'Propriétaire'

HOTEL_DEFAULT_ROLES = [
    {
        'name': OWNER_ROLE_NAME,
        'system_access_level': 'OWNER_ACCESS',
        'permissions': ['hotel.manage', 'hotel.owner'] + list(ALL_HOTEL_CRUD),
        'description': 'Compte propriétaire de l’hôtel — droits PMS (modifiables ici)',
    },
    {
        'name': 'Manager hôtel',
        'system_access_level': 'ADMIN_ACCESS',
        'permissions': ['hotel.manage'] + list(ALL_HOTEL_CRUD),
        'description': 'Admin PMS + Rôles & Permissions (CRUD complet)',
    },
    {
        'name': 'Réceptionniste',
        'system_access_level': 'RECEPTIONIST_ACCESS',
        'permissions': (
            ['hotel.front_desk']
            + _codes_for('stays')
            + _codes_for('guests')
            + _codes_for('reservations', ('view', 'create', 'update'))
            + _codes_for('rooms', ('view',))
            + _codes_for('rates', ('view',))
            + _codes_for('room_types', ('view',))
        ),
        'description': 'Check-in/out, clients, réservations (sans supprimer / confirmer admin)',
    },
    {
        'name': 'Agent réservations',
        'system_access_level': 'STAFF_ACCESS',
        'permissions': (
            ['hotel.reservations']
            + _codes_for('reservations')
            + _codes_for('rates', ('view',))
            + _codes_for('room_types', ('view',))
            + _codes_for('rooms', ('view',))
            + _codes_for('guests', ('view', 'create', 'update'))
        ),
        'description': 'CRUD réservations + confirmer / refuser / répondre au client (pas de check-in)',
    },
    {
        'name': 'Gouvernante',
        'system_access_level': 'STAFF_ACCESS',
        'permissions': (
            ['hotel.housekeeping.lead', 'hotel.housekeeping']
            + _codes_for('housekeeping')
            + _codes_for('rooms', ('view', 'update'))
        ),
        'description': 'Assigner HK, inspection, marquer Prête',
    },
    {
        'name': 'Agent de ménage',
        'system_access_level': 'STAFF_ACCESS',
        'permissions': (
            ['hotel.housekeeping']
            + _codes_for('housekeeping', ('view', 'update'))
            + _codes_for('rooms', ('view',))
        ),
        'description': 'Ses tâches uniquement (démarrer / terminer / anomalie)',
    },
    {
        'name': 'Caissier',
        'system_access_level': 'CASHIER_ACCESS',
        'permissions': (
            ['hotel.cashier']
            + _codes_for('cashier')
            + _codes_for('stays', ('view',))
        ),
        'description': 'Folios, paiements, factures',
    },
    {
        'name': 'Maintenance',
        'system_access_level': 'STAFF_ACCESS',
        'permissions': (
            ['hotel.maintenance']
            + _codes_for('maintenance')
            + _codes_for('rooms', ('view', 'update'))
        ),
        'description': 'Tickets techniques',
    },
]


# Anciens noms → nom canonique PMS
_LEGACY_ROLE_NAMES = {
    'Réception / Front desk': 'Réceptionniste',
    'Reception / Front desk': 'Réceptionniste',
    'Front desk': 'Réceptionniste',
}


def get_hotel_owner_role(business):
    from businesses.models import BusinessRole
    if not business:
        return None
    return BusinessRole.objects.filter(business=business, name=OWNER_ROLE_NAME).first()


def is_hotel_owner_role(role):
    if not role:
        return False
    name = (getattr(role, 'name', '') or '').strip().lower()
    level = (getattr(role, 'system_access_level', '') or '').upper()
    return name == OWNER_ROLE_NAME.lower() or level == 'OWNER_ACCESS'


def seed_hotel_default_roles(business, *, reset_permissions=False):
    """
    Crée les rôles PMS manquants (idempotent).

    Par défaut : ne touche JAMAIS aux permissions d'un rôle déjà existant
    (sinon les éditions « Rôles & Permissions » sont écrasées à chaque visite).

    reset_permissions=True : réapplique le catalogue (bouton resync explicite uniquement).
    """
    from businesses.models import BusinessRole

    for old_name, new_name in _LEGACY_ROLE_NAMES.items():
        legacy = BusinessRole.objects.filter(business=business, name=old_name).first()
        if not legacy:
            continue
        if BusinessRole.objects.filter(business=business, name=new_name).exists():
            continue
        legacy.name = new_name
        legacy.save(update_fields=['name'])

    created = 0
    roles = []
    for spec in HOTEL_DEFAULT_ROLES:
        role, was_created = BusinessRole.objects.get_or_create(
            business=business,
            name=spec['name'],
            defaults={
                'system_access_level': spec['system_access_level'],
                'permissions': list(spec['permissions']),
            },
        )
        if was_created:
            created += 1
        else:
            desired = list(spec['permissions'])
            current = list(role.permissions or [])
            updates = []

            # Niveau Propriétaire uniquement si incorrect
            if is_hotel_owner_role(role) and role.system_access_level != 'OWNER_ACCESS':
                role.system_access_level = 'OWNER_ACCESS'
                updates.append('system_access_level')

            if not current:
                # Rôle vide (jamais configuré) → catalogue
                role.permissions = desired
                role.system_access_level = spec['system_access_level']
                updates = ['permissions', 'system_access_level']
            elif reset_permissions:
                role.permissions = desired
                role.system_access_level = spec['system_access_level']
                updates = ['permissions', 'system_access_level']
            # sinon : conserver les permissions personnalisées telles quelles

            if updates:
                role.save(update_fields=updates)
        roles.append(role)
    return created, roles
