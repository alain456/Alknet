"""Catalogue des permissions hôpital (CRUD) et expansion des droits existants."""

CRUD = ('view', 'create', 'update', 'delete')

HOSPITAL_RESOURCES = {
    'roles': CRUD,
    'staff': CRUD,
    'settings': ('view', 'update'),
    'reports': ('view',),
    'audit': ('view',),
    'doctors': CRUD,
    'services': CRUD,
    'exams': CRUD,
    'schedules': CRUD,
    'appointments': ('view', 'create', 'update', 'delete', 'confirm', 'reject', 'check_in'),
    'patients': ('view', 'update'),
    'records': CRUD,
    'prescriptions': ('view', 'create', 'update'),
    'lab': ('view', 'create', 'update', 'validate'),
    'billing': ('view', 'create', 'update', 'delete', 'close'),
}


def _codes_for(resource, actions=None):
    acts = actions or HOSPITAL_RESOURCES[resource]
    return [f'hospital.{resource}.{action}' for action in acts]


ALL_HOSPITAL_CRUD = []
for _resource, _actions in HOSPITAL_RESOURCES.items():
    ALL_HOSPITAL_CRUD.extend(_codes_for(_resource, _actions))

BILLING = _codes_for('billing') + _codes_for('reports')
RECORDS_VIEW = _codes_for('records', ('view',)) + _codes_for('patients', ('view',)) + _codes_for('prescriptions', ('view',))
RECORDS_EDIT = RECORDS_VIEW + _codes_for('records', ('create', 'update')) + _codes_for('prescriptions', ('create', 'update'))
LAB_TECH = _codes_for('lab', ('view', 'create', 'update')) + _codes_for('exams', ('view',))
LAB = LAB_TECH + _codes_for('lab', ('validate',))


def expand_hospital_permissions(permissions):
    raw = list(permissions or [])
    out = set(raw)
    if '*' in out or 'hospital.manage' in out or 'can_manage_hospital' in out:
        out.update(ALL_HOSPITAL_CRUD)
        out.add('hospital.manage')
        out.add('can_manage_hospital')
        return out
    if 'can_manage_invoices' in out:
        out.update(BILLING)
    if 'can_edit_medical_records' in out:
        out.update(RECORDS_EDIT)
    elif 'can_view_medical_records' in out:
        out.update(RECORDS_VIEW)
    if 'can_manage_lab_results' in out:
        # Technique labo uniquement — la validation clinique reste hospital.lab.validate
        out.update(LAB_TECH)
    if 'appointment.view_confirmed' in out or 'appointment.view_audit' in out:
        out.add('hospital.appointments.view')
    if 'appointment.check_in' in out:
        out.add('hospital.appointments.view')
        out.add('hospital.appointments.check_in')
    return out


def grants(permissions, *codes):
    expanded = expand_hospital_permissions(permissions)
    return any(code in expanded for code in codes)
