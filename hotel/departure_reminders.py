"""Rappels J-1 avant check-out — staff (manager / agent résa) + client."""
from __future__ import annotations

import logging
from datetime import date, timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)

# Statuts pour lesquels le séjour / la réservation se termine demain
DEPARTURE_REMINDER_STATUSES = ('CHECKED_IN', 'CONFIRMED', 'EXPECTED')

DEFAULT_CLIENT_NOTE = (
    'Rappel : votre séjour se termine demain ({check_out}). '
    'Présentez-vous à la réception pour le check-out. '
    'Merci de votre confiance — {hotel_name}.'
)


def reservations_due_for_departure_reminder(*, on_date: date | None = None, hotel=None):
    """Réservations dont le check-out est demain (ou on_date + 1 jour)."""
    from .models import Reservation

    today = on_date or timezone.localdate()
    target = today + timedelta(days=1)
    qs = (
        Reservation.objects.filter(
            check_out_date=target,
            status__in=DEPARTURE_REMINDER_STATUSES,
            departure_reminder_sent_at__isnull=True,
        )
        .select_related('hotel', 'guest', 'room_type', 'room', 'guest__user')
        .order_by('hotel_id', 'check_out_date')
    )
    if hotel is not None:
        qs = qs.filter(hotel=hotel)
    return qs


def send_departure_reminder(reservation) -> dict:
    """Envoie alerte staff + email/notif client ; marque la réservation."""
    from .rate_resolution import notify_hotel_ops
    from .reservation_notifications import (
        hotel_display_name,
        notify_departure_reminder_client,
    )

    hotel = reservation.hotel
    hotel_name = hotel_display_name(reservation)
    guest_name = ''
    if reservation.guest_id:
        guest_name = (
            f'{reservation.guest.first_name or ""} {reservation.guest.last_name or ""}'
        ).strip()
    room_label = ''
    if reservation.room_id:
        room_label = f'Ch. {reservation.room.number}'
    elif reservation.room_type_id:
        room_label = reservation.room_type.name

    note = DEFAULT_CLIENT_NOTE.format(
        check_out=reservation.check_out_date,
        hotel_name=hotel_name,
    )

    staff = notify_hotel_ops(
        hotel,
        title=f'Départ demain — {reservation.reference}',
        message=(
            f'La réservation {reservation.reference} se termine demain '
            f'({reservation.check_out_date}).\n'
            f'Client : {guest_name or "—"}\n'
            f'Chambre / type : {room_label or "—"}\n'
            f'Statut : {reservation.status}\n\n'
            f'Préparez le check-out (réception / ménage).'
        ),
        need_reservations=True,
    )

    client = notify_departure_reminder_client(reservation, note=note)

    reservation.departure_reminder_note = note[:2000]
    reservation.departure_reminder_sent_at = timezone.now()
    reservation.save(update_fields=[
        'departure_reminder_note', 'departure_reminder_sent_at', 'updated_at',
    ])

    return {
        'ok': True,
        'reservation_id': str(reservation.id),
        'reference': reservation.reference,
        'staff': staff,
        'client': client,
    }


def process_departure_reminders(
    *, on_date: date | None = None, dry_run: bool = False, hotel=None,
) -> dict:
    """Traite toutes les réservations éligibles (idempotent via departure_reminder_sent_at)."""
    qs = list(reservations_due_for_departure_reminder(on_date=on_date, hotel=hotel))
    results = []
    if dry_run:
        return {
            'ok': True,
            'dry_run': True,
            'count': len(qs),
            'references': [r.reference for r in qs],
        }
    for res in qs:
        try:
            results.append(send_departure_reminder(res))
        except Exception:
            logger.exception('Rappel départ échoué pour %s', res.reference)
            results.append({
                'ok': False,
                'reference': res.reference,
                'error': 'send_failed',
            })
    return {
        'ok': True,
        'dry_run': False,
        'count': len(results),
        'sent': sum(1 for r in results if r.get('ok')),
        'results': results,
    }
