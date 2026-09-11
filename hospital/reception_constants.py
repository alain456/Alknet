"""Rôle et permissions de l'agent d'accueil (réceptionniste hospitalier)."""

RECEPTIONIST_ROLE_NAME = "Agent d'accueil"

# Droits réceptionniste MVP — accueil uniquement (pas confirmation admin)
RECEPTIONIST_PERMISSIONS = [
    'appointment.view_confirmed',
    'appointment.check_in',
    'appointment.view_audit',
]

RECEPTIONIST_PERMISSION_LABELS = {
    'appointment.view_confirmed': 'Voir les rendez-vous confirmés par l\'admin',
    'appointment.check_in': 'Enregistrer l\'arrivée d\'un patient (RDV confirmé)',
    'appointment.view_audit': 'Consulter l\'historique d\'un rendez-vous',
}

RECEPTIONIST_SYSTEM_ACCESS = 'RECEPTIONIST_ACCESS'

RECEPTIONIST_ROLE_DEFAULTS = {
    'name': RECEPTIONIST_ROLE_NAME,
    'system_access_level': RECEPTIONIST_SYSTEM_ACCESS,
    'permissions': RECEPTIONIST_PERMISSIONS,
}

# Statuts visibles par le réceptionniste (RDV validés par l'admin)
RECEPTIONIST_VISIBLE_STATUSES = [
    'CONFIRMED',
    'PATIENT_ARRIVED',
    'WAITING_ROOM',
    'PRESENT',
    'IN_PROGRESS',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED',
    'RESCHEDULED',
]
