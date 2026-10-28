"""Catalogue CRUD des rôles plateforme Isoko Hub."""

PLATFORM_PERM_GROUPS = [
    {
        'id': 'pilotage',
        'label': 'Pilotage',
        'actions': [
            (
                'platform.analytics.view',
                'Tableau de bord',
                'File « À traiter », analytique et recherche globale',
            ),
        ],
    },
    {
        'id': 'roles',
        'label': 'Rôles plateforme',
        'actions': [
            ('platform.roles.view', 'Voir', 'Page Rôles & permissions'),
            ('platform.roles.create', 'Créer', 'Réservé au modèle interne des rôles'),
            ('platform.roles.update', 'Modifier', 'Cocher les droits et enregistrer un rôle'),
            ('platform.roles.delete', 'Supprimer', 'Réservé au modèle interne des rôles'),
        ],
    },
    {
        'id': 'users',
        'label': 'Comptes',
        'actions': [
            ('platform.users.view', 'Voir', 'Acteurs plateforme, utilisateurs entreprises, recherche, messages contact'),
            ('platform.users.create', 'Créer', 'Créer un acteur depuis Rôles & permissions'),
            ('platform.users.update', 'Modifier', 'Éditer, activer ou désactiver un compte'),
            ('platform.users.delete', 'Supprimer', 'Supprimer un acteur plateforme'),
        ],
    },
    {
        'id': 'businesses',
        'label': 'Entreprises',
        'actions': [
            ('platform.businesses.view', 'Voir', 'Dossiers, hôtels, file entreprises à valider, recherche'),
            ('platform.businesses.create', 'Créer', 'Catalogue Entreprises'),
            ('platform.businesses.update', 'Modifier le dossier', 'Éditer une entreprise ou un hôtel'),
            ('platform.businesses.delete', 'Supprimer', 'Catalogue Entreprises'),
            ('platform.businesses.approve', 'Approuver', 'Modération'),
            ('platform.businesses.reject', 'Refuser', 'Modération'),
            ('platform.businesses.suspend', 'Suspendre', 'Entreprises, hôtels, abonnements bloqués'),
        ],
    },
    {
        'id': 'catalog',
        'label': 'Référentiels',
        'actions': [
            ('platform.catalog.view', 'Voir', 'Catégories, localisations, services'),
            ('platform.catalog.update', 'Activer un service', 'Passer un brouillon en actif ou le suspendre'),
            ('platform.professionals.view', 'Professionnels', 'Liste des professionnels'),
        ],
    },
    {
        'id': 'billing',
        'label': 'Abonnements SaaS',
        'actions': [
            ('platform.billing.view', 'Voir', 'Abonnements, grâce, expirés, recherche'),
            ('platform.billing.export', 'Exporter', 'Export des paiements SaaS'),
            ('platform.subscriptions.view', 'Lire un abonnement', 'Même écran Abonnements'),
            ('platform.alerts.view', 'Alertes d’échéance', 'Notifications de grâce et d’expiration'),
        ],
    },
    {
        'id': 'cms',
        'label': 'Contenu & contact',
        'actions': [
            ('platform.cms.view', 'Voir', 'CMS site, messages contact, recherche'),
            ('platform.cms.create', 'Créer', 'Pages publiques'),
            ('platform.cms.update', 'Modifier', 'Pages et réponses aux messages'),
            ('platform.cms.delete', 'Supprimer', 'Pages et messages'),
        ],
    },
    {
        'id': 'audit',
        'label': 'Journal',
        'actions': [
            ('platform.audit.view', 'Voir', 'Audit plateforme et audit entreprises'),
        ],
    },
    {
        'id': 'settings',
        'label': 'Réglages globaux',
        'actions': [
            ('platform.settings.view', 'Voir', 'Paramètres, plans et période de grâce'),
            ('platform.settings.update', 'Modifier', 'Plans, grâce, maintenance'),
        ],
    },
]


def _perm_key(action):
    return action[0]


ALL_PLATFORM_PERMISSIONS = [
    _perm_key(action) for group in PLATFORM_PERM_GROUPS for action in group['actions']
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

# Anciennes descriptions encore en base — on les remplace, sans écraser un texte personnalisé.
LEGACY_ROLE_DESCRIPTIONS = {
    'Tous les droits plateforme : rôles, suspension, grâce et plans.',
    'Abonnements, paiements SaaS, exports et alertes d’échéance.',
    'Approuver, refuser ou suspendre une entreprise (dont hôtels).',
    'Inbox Contact Us, lecture comptes / abonnements / journal (sans éditer le CMS).',
    'Pages publiques et CMS (création / édition / suppression).',
}

PLATFORM_ROLE_DEFAULTS = {
    'super_admin': {
        'name': 'Super admin',
        'description': (
            'Tous les droits : file « À traiter », recherche globale, rôles, '
            'modération, abonnements, CMS et plans.'
        ),
        'is_locked': True,
        'permissions': list(ALL_PLATFORM_PERMISSIONS),
    },
    'finance': {
        'name': 'Finance plateforme',
        'description': (
            'Abonnements SaaS, période de grâce, expirés, exports et alertes d’échéance.'
        ),
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
        'description': (
            'Approuver, refuser ou suspendre une entreprise (dont hôtels). '
            'Recherche des dossiers entreprises.'
        ),
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
        'description': (
            'Inbox Contact Us, recherche utilisateurs / messages, lecture des comptes, '
            'abonnements et journal — sans éditer le CMS.'
        ),
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
        'description': 'Pages publiques et CMS (création, édition, suppression).',
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
        changed = []
        if role.is_locked and set(role.permissions or []) != set(ALL_PLATFORM_PERMISSIONS):
            role.permissions = list(ALL_PLATFORM_PERMISSIONS)
            changed.append('permissions')
        elif not created and code in ('support', 'moderation'):
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
            if set(merged) != current:
                role.permissions = sorted(merged)
                changed.append('permissions')
        if (
            not created
            and role.description != spec['description']
            and (not (role.description or '').strip() or role.description in LEGACY_ROLE_DESCRIPTIONS)
        ):
            role.description = spec['description']
            changed.append('description')
        if changed:
            role.save(update_fields=list(dict.fromkeys(changed + ['updated_at'])))
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
    groups = []
    for group in PLATFORM_PERM_GROUPS:
        actions = []
        for item in group['actions']:
            key, label, *rest = item
            actions.append({
                'key': key,
                'label': label,
                'hint': rest[0] if rest else '',
            })
        groups.append({
            'id': group['id'],
            'label': group['label'],
            'actions': actions,
        })
    return groups


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
