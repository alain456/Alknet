"""Notifications gouvernante — ménage requis après check-out / changement de chambre."""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def housekeeping_leads_for(hotel):
    """
    Destinataires : gouvernantes / leads ménage dédiés.
    Si aucun lead trouvé → propriétaire de l'hôtel.
    """
    from businesses.models import BusinessEmployee
    from .permission_catalog import hotel_perm
    from .permissions import effective_hotel_permissions

    recipients = []
    seen = set()
    emps = (
        BusinessEmployee.objects.filter(business=hotel, is_active=True)
        .select_related('user', 'role')
    )
    for emp in emps:
        user = emp.user
        if not user or user.id in seen:
            continue
        eff = effective_hotel_permissions(user, hotel)
        name = ((emp.role.name if emp.role else '') or '').lower()
        pos = (emp.position or '').lower()
        is_dedicated = (
            'hotel.housekeeping.lead' in eff
            or hotel_perm('housekeeping', 'assign') in eff
            or 'gouvern' in name
            or 'gouvern' in pos
            or (
                'responsable' in name
                and ('ménage' in name or 'menage' in name or 'house' in name)
            )
        )
        if is_dedicated:
            seen.add(user.id)
            recipients.append(user)

    if not recipients and getattr(hotel, 'owner_id', None) and hotel.owner_id not in seen:
        recipients.append(hotel.owner)
    return recipients


def _hotel_label(hotel) -> str:
    profile = getattr(hotel, 'hotel_profile', None)
    trade = (getattr(profile, 'trade_name', None) or '').strip() if profile else ''
    return trade or hotel.name or 'Hôtel'


def _guest_label(stay) -> str:
    if not stay:
        return ''
    guest = getattr(stay, 'guest', None)
    if not guest:
        return ''
    return f'{guest.first_name or ""} {guest.last_name or ""}'.strip()


def notify_cleaning_required(hotel, room, task=None, stay=None, reason='checkout') -> dict:
    """
    Notifie la gouvernante qu'une chambre est en CLEANING_REQUIRED.
    - Email immédiat
    - Notification in-app (même modèle patient/staff hospital — filtrée par user)
    """
    room_number = getattr(room, 'number', None) or '—'
    guest_name = _guest_label(stay)
    hotel_name = _hotel_label(hotel)
    reason_label = (
        'après check-out'
        if reason == 'checkout'
        else 'après changement de chambre'
        if reason == 'room_change'
        else 'à traiter'
    )
    priority = getattr(task, 'priority', None) or 'HIGH'
    task_id = str(getattr(task, 'id', '') or '')

    title = f'Nettoyage requis — Ch. {room_number}'
    message = (
        f'{hotel_name} : la chambre {room_number} est en CLEANING_REQUIRED {reason_label}'
        + (f' (client : {guest_name})' if guest_name else '')
        + '.\n\n'
        'Étapes à suivre :\n'
        '1. Assigner un agent de ménage\n'
        '2. Suivre le nettoyage (démarrage / fin)\n'
        '3. Inspecter la chambre\n'
        '4. Marquer la chambre Prête (READY) pour le prochain check-in\n'
    )

    leads = housekeeping_leads_for(hotel)
    if not leads:
        return {
            'ok': False,
            'sent': False,
            'in_app': 0,
            'emails': [],
            'error': 'Aucune gouvernante / lead ménage trouvé.',
            'room_number': room_number,
            'task_id': task_id,
        }

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'noreply@isokohub.bi'
    emails_sent = []
    email_errors = []
    for user in leads:
        email = (getattr(user, 'email', None) or '').strip()
        if not email:
            continue
        try:
            send_mail(
                subject=f'[Isoko Hub] {title} — {hotel_name}',
                message=(
                    f'Bonjour {user.first_name or user.email},\n\n'
                    f'{message}\n'
                    f'Priorité : {priority}\n'
                    f'Statut chambre : CLEANING_REQUIRED\n\n'
                    f'— {hotel_name} via Isoko Hub\n'
                ),
                from_email=from_email,
                recipient_list=[email],
                fail_silently=False,
            )
            emails_sent.append(email)
        except Exception as exc:
            logger.exception('Email ménage gouvernante échoué pour %s', email)
            email_errors.append(f'{email}: {exc}')

    in_app = 0
    try:
        from hospital.models import Notification

        for user in leads:
            Notification.objects.create(
                user=user,
                notification_type='GENERAL',
                title=title,
                message=(
                    f'Ch. {room_number} — CLEANING_REQUIRED {reason_label}. '
                    'Assignez un agent, inspectez, puis marquez Prête.'
                    + (f' Client : {guest_name}.' if guest_name else '')
                ),
            )
            in_app += 1
    except Exception:
        logger.exception('Notification in-app ménage échouée')

    return {
        'ok': bool(emails_sent) or in_app > 0,
        'sent': bool(emails_sent),
        'in_app': in_app,
        'emails': emails_sent,
        'error': '; '.join(email_errors) if email_errors else '',
        'room_number': room_number,
        'task_id': task_id,
        'recipients_count': len(leads),
    }
