"""Catalogue des permissions hôtel (CRUD) + expansion des droits legacy."""

# Actions CRUD standard
CRUD = ('view', 'create', 'update', 'delete')

# resource → actions disponibles
HOTEL_RESOURCES = {
    'company': ('view', 'update'),
    'room_types': CRUD,
    'rooms': CRUD,
    'rates': CRUD,
    'services': CRUD,
    'reservations': ('view', 'create', 'update', 'delete', 'confirm', 'cancel', 'reply'),
    'guests': CRUD,
    'stays': ('view', 'update', 'check_in', 'check_out'),
    'housekeeping': ('view', 'update', 'assign'),
    'maintenance': ('view', 'create', 'update', 'resolve'),
    'cashier': ('view', 'create', 'update'),
    'roles': CRUD,
    'staff': CRUD,
    'reports': ('view',),
    'audit': ('view',),
}


def _codes_for(resource, actions=None):
    acts = actions or HOTEL_RESOURCES.get(resource, ())
    return [f'hotel.{resource}.{a}' for a in acts]


ALL_HOTEL_CRUD = []
for _res, _acts in HOTEL_RESOURCES.items():
    ALL_HOTEL_CRUD.extend(_codes_for(_res, _acts))

# Alias legacy → ensemble CRUD (rétrocompatibilité)
LEGACY_EXPAND = {
    'hotel.manage': list(ALL_HOTEL_CRUD) + ['hotel.manage', 'hotel.owner'],
    # hotel.owner = marqueur uniquement (ne donne PAS tous les droits)
    'hotel.owner': ['hotel.owner'],
    'hotel.front_desk': (
        _codes_for('stays')
        + _codes_for('guests')
        + _codes_for('reservations', ('view', 'create', 'update'))
        + _codes_for('rooms', ('view',))
        + _codes_for('rates', ('view',))
        + _codes_for('room_types', ('view',))
        + ['hotel.front_desk']
    ),
    'hotel.reservations': (
        _codes_for('reservations')
        + _codes_for('rates', ('view',))
        + _codes_for('room_types', ('view',))
        + _codes_for('rooms', ('view',))
        + _codes_for('guests', ('view', 'create', 'update'))
        + ['hotel.reservations']
    ),
    'hotel.cashier': _codes_for('cashier') + ['hotel.cashier'],
    'hotel.housekeeping': _codes_for('housekeeping', ('view', 'update')) + ['hotel.housekeeping'],
    'hotel.housekeeping.lead': (
        _codes_for('housekeeping') + ['hotel.housekeeping', 'hotel.housekeeping.lead']
    ),
    'hotel.maintenance': _codes_for('maintenance') + ['hotel.maintenance'],
}

# Lecture référentiel / ops : ponts pour rôles qui voient les séjours
# sans avoir le CRUD rooms/reservations (ex. caissier → front desk lecture)
REFERENCE_VIEW_BRIDGE = {
    'room_types': (
        'hotel.reservations.view',
        'hotel.rooms.view',
        'hotel.rates.view',
        'hotel.front_desk',
        'hotel.reservations',
        'hotel.stays.view',
    ),
    'rates': (
        'hotel.reservations.view',
        'hotel.room_types.view',
        'hotel.front_desk',
        'hotel.reservations',
        'hotel.stays.view',
    ),
    'rooms': (
        'hotel.reservations.view',
        'hotel.stays.view',
        'hotel.stays.check_in',
        'hotel.stays.check_out',
        'hotel.front_desk',
        'hotel.reservations',
        'hotel.cashier.view',
    ),
    'reservations': (
        'hotel.stays.view',
        'hotel.stays.check_in',
        'hotel.stays.check_out',
        'hotel.front_desk',
        'hotel.cashier.view',
    ),
}


def expand_hotel_permissions(permissions):
    """Étend une liste (legacy + CRUD) en ensemble effectif."""
    raw = list(permissions or [])
    out = set(raw)
    if '*' in out or 'hotel.manage' in out:
        out.update(ALL_HOTEL_CRUD)
        out.add('hotel.manage')
        return out
    for code in list(out):
        expanded = LEGACY_EXPAND.get(code)
        if expanded:
            out.update(expanded)
    return out


def hotel_perm(resource, action):
    return f'hotel.{resource}.{action}'
