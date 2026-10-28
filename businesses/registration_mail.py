"""Trois e-mails d'inscription entreprise, textes modifiables par le super admin."""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

PLACEHOLDERS = (
    '{business_name}',
    '{category}',
    '{owner_name}',
    '{login_url}',
    '{note}',
)

DEFAULT_MESSAGES = {
    'received': (
        'Bonjour {owner_name},\n\n'
        'Nous avons bien reçu la demande d’inscription de votre entreprise sur Isoko Hub. '
        'Votre dossier est arrivé et sera examiné.\n\n'
        'Entreprise : {business_name}\n'
        'Catégorie : {category}\n'
        'Statut : En attente de validation\n\n'
        'Vous recevrez un autre message lorsque le dossier sera approuvé ou refusé. '
        'La connexion à votre espace professionnel sera possible uniquement après l’approbation.\n\n'
        '— L’équipe Isoko Hub\n'
    ),
    'approved': (
        'Bonjour {owner_name},\n\n'
        'L’inscription de votre entreprise a été acceptée sur Isoko Hub.\n\n'
        'Entreprise : {business_name}\n'
        'Catégorie : {category}\n'
        'Statut : Approuvée\n'
        '{note}\n\n'
        'Vous pouvez vous connecter à votre espace professionnel :\n'
        '{login_url}\n\n'
        '— L’équipe Isoko Hub\n'
    ),
    'rejected': (
        'Bonjour {owner_name},\n\n'
        'Après examen, l’inscription de votre entreprise n’a pas pu être acceptée.\n\n'
        'Entreprise : {business_name}\n'
        'Catégorie : {category}\n'
        'Statut : Refusée\n\n'
        'Motif :\n'
        '{note}\n\n'
        'Vous pouvez corriger votre dossier et nous recontacter.\n\n'
        '— L’équipe Isoko Hub\n'
    ),
}

SUBJECTS = {
    'received': 'Isoko Hub — Votre dossier « {business_name} » est bien arrivé',
    'approved': 'Isoko Hub — Votre entreprise « {business_name} » a été approuvée',
    'rejected': 'Isoko Hub — Inscription refusée pour « {business_name} »',
}

FIELDS = {
    'received': 'business_received_message',
    'approved': 'business_approved_message',
    'rejected': 'business_rejected_message',
}


def message_templates():
    from site_content.models import SiteSettings
    settings_row = SiteSettings.get_solo()
    stored = {}
    for kind, field in FIELDS.items():
        custom = (getattr(settings_row, field, '') or '').strip()
        stored[kind] = custom or DEFAULT_MESSAGES[kind]
    return {
        'received_message': stored['received'],
        'approved_message': stored['approved'],
        'rejected_message': stored['rejected'],
        'default_received_message': DEFAULT_MESSAGES['received'],
        'default_approved_message': DEFAULT_MESSAGES['approved'],
        'default_rejected_message': DEFAULT_MESSAGES['rejected'],
        'placeholders': list(PLACEHOLDERS),
    }


def _owner_name(business):
    owner = getattr(business, 'owner', None)
    if owner is None:
        return 'Bonjour'
    full = ''
    if hasattr(owner, 'get_full_name'):
        full = (owner.get_full_name() or '').strip()
    if full and full != getattr(owner, 'email', ''):
        return full
    return getattr(owner, 'email', None) or 'Bonjour'


def render_registration_message(kind, business, note=''):
    templates = message_templates()
    body = templates[f'{kind}_message']
    frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173'
    values = {
        'business_name': business.name or '',
        'category': getattr(getattr(business, 'primary_category', None), 'name', None) or 'Non spécifiée',
        'owner_name': _owner_name(business),
        'login_url': f'{frontend_url.rstrip("/")}/login',
        'note': (note or '').strip(),
    }
    message = str(body)
    for key, value in values.items():
        message = message.replace('{' + key + '}', value)
    subject = SUBJECTS[kind]
    for key, value in values.items():
        subject = subject.replace('{' + key + '}', value)
    lines = []
    for line in message.splitlines():
        if not values['note'] and line.strip() in ('Motif :', 'Motif:', '{note}'):
            continue
        lines.append(line)
    cleaned = '\n'.join(lines)
    while '\n\n\n' in cleaned:
        cleaned = cleaned.replace('\n\n\n', '\n\n')
    return subject.strip(), cleaned.strip()


def send_registration_email(business, kind, note=''):
    from accounts.outbound_mail import send_isoko_mail

    recipient = (business.email or '').strip() or (getattr(getattr(business, 'owner', None), 'email', None) or '').strip()
    if not recipient:
        return {'status': 'SKIPPED', 'reason': 'Aucun email entreprise/propriétaire'}
    subject, body = render_registration_message(kind, business, note=note)
    try:
        send_isoko_mail(subject, body, [recipient])
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        logger.exception('Échec e-mail inscription %s pour %s', kind, business.id)
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}
