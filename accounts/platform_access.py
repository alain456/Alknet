"""Catalogue CRUD des rôles plateforme Isoko Hub."""

PLATFORM_PERM_GROUPS = [
    {
        'id': 'roles',
        'label': 'Rôles plateforme',
        'actions': [
            ('platform.roles.view', 'Voir'),
            ('platform.roles.create', 'Créer'),
            ('platform.roles.update', 'Modifier'),
            ('platform.roles.delete', 'Supprimer'),
        ],
    },
    {
        'id': 'users',
        'label': 'Comptes',
        'actions': [
            ('platform.users.view', 'Voir'),
            ('platform.users.create', 'Créer'),
            ('platform.users.update', 'Modifier'),
            ('platform.users.delete', 'Supprimer'),
        ],
    },
    {
        'id': 'businesses',
        'label': 'Entreprises',
        'actions': [
            ('platform.businesses.view', 'Voir'),
            ('platform.businesses.create', 'Créer'),
            ('platform.businesses.update', 'Modifier le dossier'),
            ('platform.businesses.delete', 'Supprimer'),
            ('platform.businesses.approve', 'Approuver'),
            ('platform.businesses.reject', 'Refuser'),
            ('platform.businesses.suspend', 'Suspendre'),
        ],
    },
    {
        'id': 'settings',
        'label': 'Réglages globaux',
        'actions': [
            ('platform.settings.view', 'Voir'),
            ('platform.settings.update', 'Modifier'),
        ],
    },
    {
        'id': 'billing',
        'label': 'Abonnements SaaS',
        'actions': [
            ('platform.billing.view', 'Voir'),
            ('platform.billing.export', 'Exporter'),
            ('platform.subscriptions.view', 'Lire un abonnement'),
            ('platform.alerts.view', 'Alertes d’échéance'),
        ],
    },
    {
        'id': 'audit',
        'label': 'Journal',
        'actions': [
            ('platform.audit.view', 'Voir'),
        ],
    },
    {
        'id': 'cms',
        'label': 'Contenu public',
        'actions': [
            ('platform.cms.view', 'Voir'),
            ('platform.cms.create', 'Créer'),
            ('platform.cms.update', 'Modifier'),
            ('platform.cms.delete', 'Supprimer'),
        ],
    },
    {
        'id': 'catalog',
        'label': 'Référentiels',
        'actions': [
            ('platform.analytics.view', 'Analytique'),
            ('platform.catalog.view', 'Voir'),
            ('platform.catalog.update', 'Modifier'),
            ('platform.professionals.view', 'Professionnels'),
        ],
    },
]

ALL_PLATFORM_PERMISSIONS = [
    key for group in PLATFORM_PERM_GROUPS for key, _label in group['actions']
]

ROLE_TO_CODE = {
    'SUPER_ADMIN': 'super_admin',
    'PLATFORM_FINANCE': 'finance',
    'PLATFORM_MODERATION': 'moderation',
    'PLATFORM_SUPPORT': 'support',
    'PLATFORM_CONTENT': 'content',
}

CODE_TO_ROLE = {code: role for role, code in ROLE_TO_CODE.items()}

PLATFORM_USER_ROLES = tuple(ROLE_TO_CODE.keys())

PLATFORM_ROLE_DEFAULTS = {
    'super_admin': {
        'name': 'Super admin',
        'description': 'Tous les droits plateforme : rôles, suspension, grâce et plans.',
        'is_locked': True,
        'permissions': list(ALL_PLATFORM_PERMISSIONS),
    },
    'finance': {
        'name': 'Finance plateforme',
        'description': 'Abonnements, paiements SaaS, exports et alertes d’échéance.',
        'is_locked': False,
        'permissions': [
            'platform.billing.view',
            'platform.billing.export',
            'platform.subscriptions.view',
            'platform.alerts.view',
        ],
    },
    'moderation': {
        'name': 'Modération',
        'description': 'Approuver, refuser ou suspendre une entreprise (dont hôtels).',
        'is_locked': False,
        'permissions': [
            'platform.businesses.view',
            'platform.businesses.update',
            'platform.businesses.approve',
            'platform.businesses.reject',
            'platform.businesses.suspend',
        ],
    },
    'support': {
        'name': 'Support',
        'description': 'Inbox Contact Us, lecture comptes / abonnements / journal (sans éditer le CMS).',
        'is_locked': False,
        'permissions': [
            'platform.users.view',
            'platform.subscriptions.view',
            'platform.audit.view',
            'platform.cms.view',
        ],
    },
    'content': {
        'name': 'Contenu',
        'description': 'Pages publiques et CMS (création / édition / suppression).',
        'is_locked': False,
        'permissions': [
            'platform.cms.view',
            'platform.cms.create',
            'platform.cms.update',
            'platform.cms.delete',
        ],
    },
}


def ensure_platform_roles():
    from .models import PlatformRole

    for code, spec in PLATFORM_ROLE_DEFAULTS.items():
        role, created = PlatformRole.objects.get_or_create(
            code=code,
            defaults={
                'name': spec['name'],
                'description': spec['description'],
                'permissions': spec['permissions'],
                'is_locked': spec['is_locked'],
            },
        )
        if role.is_locked and set(role.permissions) != set(ALL_PLATFORM_PERMISSIONS):
            role.permissions = list(ALL_PLATFORM_PERMISSIONS)
            role.save(update_fields=['permissions', 'updated_at'])
        elif created:
            continue
        elif code in ('support', 'moderation'):
            # Aligne les droits minimaux (inbox support / suspend modération)
            needed = set(spec['permissions'])
            current = set(role.permissions or [])
            # Support : retire cms.update/create/delete s’ils étaient hérités trop larges
            if code == 'support':
                stripped = current - {
                    'platform.cms.create', 'platform.cms.update', 'platform.cms.delete',
                }
                merged = stripped | needed
            else:
                merged = current | needed
            if set(merged) != current or role.description != spec['description']:
                role.permissions = sorted(merged)
                role.description = spec['description']
                role.save(update_fields=['permissions', 'description', 'updated_at'])
    return PlatformRole.objects.all()


def permissions_for_user(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return []
    if getattr(user, 'role', None) == 'SUPER_ADMIN' or getattr(user, 'is_superuser', False):
        return list(ALL_PLATFORM_PERMISSIONS)
    code = ROLE_TO_CODE.get(getattr(user, 'role', None))
    if not code:
        return []
    from .models import PlatformRole

    role = PlatformRole.objects.filter(code=code).first()
    if role is None:
        ensure_platform_roles()
        role = PlatformRole.objects.filter(code=code).first()
    if role is None:
        return list(PLATFORM_ROLE_DEFAULTS.get(code, {}).get('permissions') or [])
    return list(role.permissions or [])


def user_has_platform_perm(user, key):
    if not key:
        return False
    return key in permissions_for_user(user)


def user_has_any_platform_perm(user, keys):
    granted = set(permissions_for_user(user))
    return any(key in granted for key in keys)


def catalog_payload():
    return [
        {
            'id': group['id'],
            'label': group['label'],
            'actions': [{'key': key, 'label': label} for key, label in group['actions']],
        }
        for group in PLATFORM_PERM_GROUPS
    ]


def update_platform_role(code, permissions=None, name=None, description=None):
    ensure_platform_roles()
    from .models import PlatformRole

    role = PlatformRole.objects.filter(code=code).first()
    if role is None:
        raise ValueError('Rôle plateforme inconnu.')
    if role.is_locked and permissions is not None:
        raise ValueError('Le super admin conserve tous les droits.')
    changed = []
    if name is not None:
        cleaned_name = str(name).strip()
        if not cleaned_name:
            raise ValueError('Le nom du rôle est obligatoire.')
        if cleaned_name != role.name:
            role.name = cleaned_name
            changed.append('name')
    if description is not None and str(description) != (role.description or ''):
        role.description = str(description)
        changed.append('description')
    if permissions is not None and not role.is_locked:
        cleaned = []
        unknown = []
        for key in permissions or []:
            if key in ALL_PLATFORM_PERMISSIONS and key not in cleaned:
                cleaned.append(key)
            elif key not in ALL_PLATFORM_PERMISSIONS:
                unknown.append(key)
        if unknown:
            raise ValueError('Permission inconnue.')
        if list(role.permissions or []) != cleaned:
            role.permissions = cleaned
            changed.append('permissions')
    if changed:
        role.save(update_fields=list(dict.fromkeys(changed + ['updated_at'])))
    return role


def role_label_for_user(user):
    """Nom dynamique du rôle plateforme (modifiable par le super admin)."""
    if not user:
        return ''
    code = ROLE_TO_CODE.get(getattr(user, 'role', None))
    if not code:
        getter = getattr(user, 'get_role_display', None)
        return getter() if callable(getter) else (getattr(user, 'role', '') or '')
    ensure_platform_roles()
    from .models import PlatformRole

    row = PlatformRole.objects.filter(code=code).only('name').first()
    if row and row.name:
        return row.name
    return PLATFORM_ROLE_DEFAULTS.get(code, {}).get('name') or getattr(user, 'get_role_display', lambda: code)()


def role_name_for_code(code):
    if not code:
        return ''
    ensure_platform_roles()
    from .models import PlatformRole

    row = PlatformRole.objects.filter(code=code).only('name').first()
    if row and row.name:
        return row.name
    return PLATFORM_ROLE_DEFAULTS.get(code, {}).get('name') or code


def role_label_from_role_key(role_key):
    """Libellé dynamique pour un code rôle (SUPER_ADMIN, PLATFORM_FINANCE, BUSINESS_OWNER…)."""
    if not role_key:
        return ''
    code = ROLE_TO_CODE.get(role_key)
    if code:
        return role_name_for_code(code)
    business_labels = {
        'BUSINESS_OWNER': 'Admin entreprise',
        'PROFESSIONAL': 'Professionnel / Staff',
        'CUSTOMER': 'Utilisateur standard',
        'ANONYMOUS': 'Anonyme',
    }
    return business_labels.get(role_key, role_key)
