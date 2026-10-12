"""Catalogue des permissions Éducation.

Les codes sont ceux du cahier des charges, sans renommage : le super admin
plateforme ne les porte pas (il supervise via la modération entreprises),
seul l'établissement les détient.
"""

# (ressources → actions) alignés sur `education/<...>` du prompt
EDUCATION_RESOURCES = {
    'profile': ('view', 'update'),
    'structure': ('view', 'create', 'update', 'delete', 'manage'),
    'programs': ('view', 'create', 'update', 'delete', 'manage'),
    'admissions': ('view', 'create', 'update', 'delete', 'manage'),
    'fees': ('view', 'create', 'update', 'delete', 'manage'),
    'services': ('view', 'create', 'update', 'delete', 'manage'),
}

# Les six droits listés explicitement au cahier des charges.
PROFILE_VIEW = 'education.profile.view'
PROFILE_UPDATE = 'education.profile.update'
STRUCTURE_MANAGE = 'education.structure.manage'
PROGRAMS_MANAGE = 'education.programs.manage'
ADMISSIONS_MANAGE = 'education.admissions.manage'
FEES_MANAGE = 'education.fees.manage'
SERVICES_MANAGE = 'education.services.manage'

CORE_CODES = (
    PROFILE_VIEW,
    PROFILE_UPDATE,
    STRUCTURE_MANAGE,
    PROGRAMS_MANAGE,
    ADMISSIONS_MANAGE,
    FEES_MANAGE,
    SERVICES_MANAGE,
)


def _codes_for(resource, actions):
    return [f'education.{resource}.{action}' for action in actions]


ALL_EDUCATION_CODES = []
for _resource, _actions in EDUCATION_RESOURCES.items():
    ALL_EDUCATION_CODES.extend(_codes_for(_resource, _actions))

# Raccourcis hérités des écrans métier vers les CRUD fins.
ALIASES = {
    PROGRAMS_MANAGE: _codes_for('programs', ('view', 'create', 'update', 'delete')),
    STRUCTURE_MANAGE: _codes_for('structure', ('view', 'create', 'update', 'delete')),
    ADMISSIONS_MANAGE: _codes_for('admissions', ('view', 'create', 'update', 'delete')),
    FEES_MANAGE: _codes_for('fees', ('view', 'create', 'update', 'delete')),
    SERVICES_MANAGE: _codes_for('services', ('view', 'create', 'update', 'delete')),
}


def expand_education_permissions(permissions):
    """Ouvre les CRUD fins derrière un droit de gestion, comme l'hôpital."""
    raw = list(permissions or [])
    out = set(raw)
    if '*' in out or 'education.manage' in out:
        out.update(ALL_EDUCATION_CODES)
        out.add('education.manage')
        return out
    for alias, codes in ALIASES.items():
        if alias in out:
            out.update(codes)
    return out


def education_perm(user, business, code):
    """True si l'utilisateur détient `code` sur cet établissement.

    Propriétaire : tout. Employé : les droits de son rôle. Super admin
    plateforme : jamais (il ne fait pas le métier à la place de l'école).
    """
    from businesses.models import Business, BusinessEmployee

    if not user or not user.is_authenticated or not business:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN':
        return False
    if getattr(business, 'owner_id', None) == user.id:
        return True

    for emp in BusinessEmployee.objects.filter(
        business=business, user=user, is_active=True,
    ).select_related('role'):
        if not emp.role:
            continue
        if code in expand_education_permissions(emp.role.permissions or []):
            return True
    return False
