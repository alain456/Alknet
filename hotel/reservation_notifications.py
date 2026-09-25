"""Emails client — réservations hôtel (demande, confirmation, refus)."""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def guest_contact_email(reservation) -> str:
    guest = getattr(reservation, 'guest', None)
    if not guest:
        return ''
    email = (guest.email or '').strip()
    if email:
        return email
    user = getattr(guest, 'user', None)
    if user and getattr(user, 'email', None):
        return (user.email or '').strip()
    return ''


def guest_display_name(reservation) -> str:
    guest = getattr(reservation, 'guest', None)
    if not guest:
        return 'Client'
    name = f'{guest.first_name or ""} {guest.last_name or ""}'.strip()
    return name or guest_contact_email(reservation) or 'Client'


def hotel_display_name(reservation) -> str:
    hotel = reservation.hotel
    profile = getattr(hotel, 'hotel_profile', None)
    if profile is None:
        try:
            profile = hotel.hotel_profile
        except Exception:
            profile = None
    trade = (getattr(profile, 'trade_name', None) or '').strip() if profile else ''
    return trade or hotel.name


def _room_label(reservation) -> str:
    if reservation.room_id:
        return f'Ch. {reservation.room.number}'
    if reservation.room_type_id:
        return reservation.room_type.name
    return '—'


def template_context(reservation, reason: str = '', stay=None, invoice=None) -> dict:
    room_number = ''
    if stay and getattr(stay, 'room', None):
        room_number = stay.room.number or ''
    elif reservation.room_id:
        room_number = reservation.room.number or ''

    actual_in = ''
    actual_out = ''
    if stay:
        if stay.actual_check_in:
            actual_in = stay.actual_check_in.strftime('%Y-%m-%d %H:%M')
        if stay.actual_check_out:
            actual_out = stay.actual_check_out.strftime('%Y-%m-%d %H:%M')

    inv_number = ''
    inv_total = ''
    if invoice is not None:
        inv_number = getattr(invoice, 'number', '') or ''
        inv_total = str(getattr(invoice, 'total', '') or '')

    return {
        'guest_name': guest_display_name(reservation),
        'hotel_name': hotel_display_name(reservation),
        'reference': reservation.reference or '',
        'check_in': str(reservation.check_in_date or ''),
        'check_out': str(reservation.check_out_date or ''),
        'amount': str(reservation.total_amount or '0'),
        'currency': reservation.currency or 'BIF',
        'room_type': _room_label(reservation),
        'room_number': room_number or _room_label(reservation),
        'payment_status': reservation.payment_status or '',
        'reason': (reason or '').strip(),
        'actual_check_in': actual_in,
        'actual_check_out': actual_out,
        'invoice_number': inv_number,
        'invoice_total': inv_total,
    }


class _SafeDict(dict):
    def __missing__(self, key):
        return '{' + key + '}'


def render_template(template: str, ctx: dict, fallback: str) -> str:
    text = (template or '').strip() or fallback
    try:
        return text.format_map(_SafeDict(ctx))
    except Exception:
        return fallback.format_map(_SafeDict(ctx))


def _profile(reservation):
    hotel = reservation.hotel
    try:
        return hotel.hotel_profile
    except Exception:
        return None


def _send(reservation, subject: str, body: str) -> dict:
    recipient = guest_contact_email(reservation)
    if not recipient:
        return {
            'ok': False,
            'sent': False,
            'error': 'Aucune adresse email client disponible.',
            'recipient': '',
        }
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'noreply@isokohub.bi'
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[recipient],
            fail_silently=False,
        )
        return {'ok': True, 'sent': True, 'error': '', 'recipient': recipient}
    except Exception as exc:
        logger.exception('Email réservation %s échoué', reservation.reference)
        return {'ok': False, 'sent': False, 'error': str(exc), 'recipient': recipient}


DEFAULT_REQUEST = (
    'Bonjour {guest_name},\n\n'
    'Nous avons bien reçu votre demande de réservation chez {hotel_name}.\n\n'
    'Référence : {reference}\n'
    'Arrivée : {check_in}\n'
    'Départ : {check_out}\n'
    'Montant estimé : {amount} {currency}\n'
    'Statut paiement : {payment_status}\n\n'
    "L'établissement confirmera ou refusera votre demande après validation.\n"
    "Vous recevrez un nouvel email dès qu'une décision sera prise.\n\n"
    '— {hotel_name} via Isoko Hub\n'
)

DEFAULT_CONFIRM = (
    'Bonjour {guest_name},\n\n'
    'Bonne nouvelle : votre réservation chez {hotel_name} est confirmée.\n\n'
    'Référence : {reference}\n'
    'Arrivée : {check_in}\n'
    'Départ : {check_out}\n'
    'Type / chambre : {room_type}\n'
    'Montant : {amount} {currency}\n\n'
    "Présentez-vous à la réception le jour d'arrivée avec votre référence.\n\n"
    '— {hotel_name} via Isoko Hub\n'
)

DEFAULT_REJECT = (
    'Bonjour {guest_name},\n\n'
    "Votre demande de réservation chez {hotel_name} n'a pas pu être acceptée.\n\n"
    'Référence : {reference}\n'
    'Arrivée prévue : {check_in}\n'
    'Départ prévu : {check_out}\n\n'
    'Motif : {reason}\n\n'
    "Vous pouvez effectuer une nouvelle demande ou contacter l'établissement.\n\n"
    '— {hotel_name} via Isoko Hub\n'
)

DEFAULT_CHECK_IN = (
    'Bonjour {guest_name},\n\n'
    'Bienvenue chez {hotel_name} ! Votre check-in est enregistré.\n\n'
    'Référence : {reference}\n'
    'Chambre : {room_number}\n'
    'Arrivée : {check_in}\n'
    'Départ prévu : {check_out}\n'
    "Heure d'enregistrement : {actual_check_in}\n\n"
    'Nous vous souhaitons un excellent séjour.\n\n'
    '— {hotel_name} via Isoko Hub\n'
)

DEFAULT_CHECK_OUT = (
    'Bonjour {guest_name},\n\n'
    'Votre check-out chez {hotel_name} est terminé. Merci de votre séjour.\n\n'
    'Référence : {reference}\n'
    'Chambre : {room_number}\n'
    'Facture : {invoice_number}\n'
    'Total : {invoice_total} {currency}\n'
    'Départ enregistré : {actual_check_out}\n\n'
    'À bientôt !\n\n'
    '— {hotel_name} via Isoko Hub\n'
)


def notify_reservation_requested(reservation) -> dict:
    ctx = template_context(reservation)
    profile = _profile(reservation)
    template = getattr(profile, 'reservation_request_email_message', '') if profile else ''
    body = render_template(template, ctx, DEFAULT_REQUEST)
    result = _send(
        reservation,
        subject=f'[Isoko Hub] Demande de réservation {reservation.reference} reçue',
        body=body,
    )
    result['type'] = 'RESERVATION_REQUESTED'
    return result


def _notify_client_in_app(reservation, *, title: str, message: str) -> bool:
    guest = getattr(reservation, 'guest', None)
    user = getattr(guest, 'user', None) if guest else None
    if not user:
        return False
    try:
        from hospital.models import Notification
        hotel_id = getattr(reservation, 'hotel_id', None) or getattr(reservation.hotel, 'id', '')
        hint = f' Voir : /hotels/{hotel_id}/historique' if hotel_id else ''
        Notification.objects.create(
            user=user,
            notification_type='GENERAL',
            title=(title or 'Réservation hôtel')[:200],
            message=((message or '') + hint)[:500],
        )
        return True
    except Exception:
        logger.exception('Notification in-app client hôtel échouée')
        return False


def notify_reservation_confirmed(reservation) -> dict:
    ctx = template_context(reservation)
    profile = _profile(reservation)
    template = getattr(profile, 'reservation_confirm_email_message', '') if profile else ''
    body = render_template(template, ctx, DEFAULT_CONFIRM)
    result = _send(
        reservation,
        subject=f'[Isoko Hub] Réservation {reservation.reference} confirmée',
        body=body,
    )
    result['type'] = 'RESERVATION_CONFIRMED'
    note = (getattr(reservation, 'decision_note', None) or '').strip()
    result['in_app'] = _notify_client_in_app(
        reservation,
        title=f'Réservation confirmée — {ctx["hotel_name"]}',
        message=(
            f'Votre réservation {reservation.reference} a été confirmée.'
            + (f' {note}' if note else '')
        ),
    )
    return result


def notify_reservation_rejected(reservation, reason: str = '') -> dict:
    ctx = template_context(reservation, reason=reason)
    profile = _profile(reservation)
    template = getattr(profile, 'reservation_reject_email_message', '') if profile else ''
    body = render_template(template, ctx, DEFAULT_REJECT)
    result = _send(
        reservation,
        subject=f'[Isoko Hub] Réservation {reservation.reference} refusée',
        body=body,
    )
    result['type'] = 'RESERVATION_REJECTED'
    motif = (reason or getattr(reservation, 'decision_note', None) or '').strip()
    result['in_app'] = _notify_client_in_app(
        reservation,
        title=f'Réservation refusée — {ctx["hotel_name"]}',
        message=(
            f'Votre demande {reservation.reference} a été refusée.'
            + (f' Motif : {motif}' if motif else '')
        ),
    )
    return result


def notify_check_in(reservation, stay=None) -> dict:
    ctx = template_context(reservation, stay=stay)
    profile = _profile(reservation)
    template = getattr(profile, 'check_in_email_message', '') if profile else ''
    body = render_template(template, ctx, DEFAULT_CHECK_IN)
    result = _send(
        reservation,
        subject=f'[Isoko Hub] Check-in {reservation.reference} — bienvenue',
        body=body,
    )
    result['type'] = 'CHECK_IN'
    return result


def notify_check_out(reservation, stay=None, invoice=None) -> dict:
    ctx = template_context(reservation, stay=stay, invoice=invoice)
    profile = _profile(reservation)
    template = getattr(profile, 'check_out_email_message', '') if profile else ''
    body = render_template(template, ctx, DEFAULT_CHECK_OUT)
    result = _send(
        reservation,
        subject=f'[Isoko Hub] Check-out {reservation.reference} — merci',
        body=body,
    )
    result['type'] = 'CHECK_OUT'
    return result


def notify_reschedule_response(reservation, *, accepted: bool, note: str = '') -> dict:
    """Email client après acceptation / refus d'un report ou d'une anticipation."""
    ctx = template_context(reservation, reason=note)
    ctx['admin_note'] = (note or '').strip()
    ctx['new_check_in'] = str(reservation.check_in_date or '')
    ctx['new_check_out'] = str(reservation.check_out_date or '')
    hotel_name = ctx['hotel_name']
    if accepted:
        body = (
            f'Bonjour {ctx["guest_name"]},\n\n'
            f'Votre demande de modification de dates chez {hotel_name} a été acceptée.\n\n'
            f'Référence : {ctx["reference"]}\n'
            f'Nouvelles dates : {ctx["new_check_in"]} → {ctx["new_check_out"]}\n'
            + (f'Message de l\'hôtel : {note}\n\n' if note else '\n')
            + f'— {hotel_name} via Isoko Hub\n'
        )
        subject = f'[Isoko Hub] Dates modifiées — {reservation.reference}'
    else:
        body = (
            f'Bonjour {ctx["guest_name"]},\n\n'
            f'Votre demande de modification de dates chez {hotel_name} a été refusée.\n\n'
            f'Référence : {ctx["reference"]}\n'
            f'Dates actuelles : {ctx["check_in"]} → {ctx["check_out"]}\n'
            + (f'Motif : {note}\n\n' if note else '\n')
            + f'— {hotel_name} via Isoko Hub\n'
        )
        subject = f'[Isoko Hub] Modification de dates refusée — {reservation.reference}'
    result = _send(reservation, subject=subject, body=body)
    result['type'] = 'RESCHEDULE_ACCEPTED' if accepted else 'RESCHEDULE_REFUSED'
    return result


def notify_departure_reminder_client(reservation, note: str = '') -> dict:
    """Email + notif in-app : séjour se termine demain."""
    ctx = template_context(reservation, reason=note)
    hotel_name = ctx['hotel_name']
    body = (
        f'Bonjour {ctx["guest_name"]},\n\n'
        f'Rappel : votre séjour chez {hotel_name} se termine demain.\n\n'
        f'Référence : {ctx["reference"]}\n'
        f'Date de départ (check-out) : {ctx["check_out"]}\n'
        f'Type / chambre : {ctx["room_type"]}\n\n'
        f'Présentez-vous à la réception pour le check-out.\n'
        f'Vous pouvez aussi consulter ce rappel dans votre historique Isoko Hub.\n\n'
        f'— {hotel_name} via Isoko Hub\n'
    )
    result = _send(
        reservation,
        subject=f'[Isoko Hub] Départ demain — {reservation.reference}',
        body=body,
    )
    result['type'] = 'DEPARTURE_REMINDER'

    guest = getattr(reservation, 'guest', None)
    user = getattr(guest, 'user', None) if guest else None
    if user:
        try:
            from hospital.models import Notification
            Notification.objects.create(
                user=user,
                notification_type='GENERAL',
                title=f'Départ demain — {hotel_name}',
                message=(
                    f'Votre séjour {reservation.reference} se termine demain '
                    f'({reservation.check_out_date}). Consultez votre historique.'
                )[:500],
            )
            result['in_app'] = True
        except Exception:
            logger.exception('Notification in-app rappel départ échouée')
            result['in_app'] = False
    else:
        result['in_app'] = False
    return result


def notify_hotel_reply(reservation, message: str) -> dict:
    """Email + notification in-app client après réponse hôtel sur l'historique."""
    ctx = template_context(reservation, reason=message)
    hotel_name = ctx['hotel_name']
    body = (
        f'Bonjour {ctx["guest_name"]},\n\n'
        f'L\'hôtel {hotel_name} a répondu à votre message concernant la réservation '
        f'{ctx["reference"]}.\n\n'
        f'« {message} »\n\n'
        f'Consultez l\'historique de vos échanges avec l\'établissement sur Isoko Hub.\n\n'
        f'— {hotel_name} via Isoko Hub\n'
    )
    result = _send(
        reservation,
        subject=f'[Isoko Hub] Réponse de {hotel_name} — {reservation.reference}',
        body=body,
    )
    result['type'] = 'HOTEL_REPLY'

    guest = getattr(reservation, 'guest', None)
    user = getattr(guest, 'user', None) if guest else None
    if user:
        try:
            from hospital.models import Notification
            Notification.objects.create(
                user=user,
                notification_type='GENERAL',
                title=f'Réponse de {hotel_name}',
                message=(
                    f'Réponse sur {reservation.reference} : '
                    f'{message[:400]}'
                ),
            )
            result['in_app'] = True
        except Exception:
            logger.exception('Notification in-app réponse hôtel échouée')
            result['in_app'] = False
    else:
        result['in_app'] = False
    return result
