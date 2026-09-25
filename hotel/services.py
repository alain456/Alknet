import json
from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    Reservation, Stay, Folio, FolioItem, HotelInvoice, HousekeepingTask,
    HotelAuditLog, Room, HotelProfile,
)


def _json_safe(value):
    """Convert serializer/DRF data into JSONField-safe structures."""
    if value is None:
        return {}
    try:
        return json.loads(json.dumps(value, cls=DjangoJSONEncoder))
    except TypeError:
        # Fallback for leftover non-encodable types (UUID, etc.)
        def _coerce(obj):
            if isinstance(obj, dict):
                return {str(k): _coerce(v) for k, v in obj.items()}
            if isinstance(obj, (list, tuple)):
                return [_coerce(v) for v in obj]
            if isinstance(obj, UUID):
                return str(obj)
            if isinstance(obj, (date, datetime, time)):
                return obj.isoformat()
            if isinstance(obj, Decimal):
                return str(obj)
            return obj
        return _coerce(value)


def next_reference(hotel, kind='RES'):
    year = timezone.now().year
    profile, _ = HotelProfile.objects.get_or_create(business=hotel)
    prefix = (profile.reference_prefix or 'HOT').upper()
    if kind == 'RES':
        pattern = f'RES-{prefix}-{year}-'
        last = (
            Reservation.objects.filter(hotel=hotel, reference__startswith=pattern)
            .order_by('-reference')
            .values_list('reference', flat=True)
            .first()
        )
    else:
        pattern = f'INV-{prefix}-{year}-'
        last = (
            HotelInvoice.objects.filter(hotel=hotel, number__startswith=pattern)
            .order_by('-number')
            .values_list('number', flat=True)
            .first()
        )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit('-', 1)[-1]) + 1
        except ValueError:
            seq = 1
    return f'{pattern}{seq:06d}'


def audit(hotel, actor, action, entity_type, entity_id='', old=None, new=None):
    HotelAuditLog.objects.create(
        hotel=hotel,
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id or ''),
        old_value=_json_safe(old),
        new_value=_json_safe(new),
    )


def dates_overlap(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def room_has_conflict(room, check_in, check_out, exclude_reservation_id=None):
    qs = Reservation.objects.filter(
        room=room,
        status__in=Reservation.ACTIVE_STATUSES,
    )
    if exclude_reservation_id:
        qs = qs.exclude(pk=exclude_reservation_id)
    for r in qs:
        if dates_overlap(check_in, check_out, r.check_in_date, r.check_out_date):
            return True
    return False


def assert_room_assignable(room, check_in, check_out, exclude_reservation_id=None):
    if not room:
        return
    if room.operational_status in ('MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE'):
        raise ValidationError({'room': 'Chambre indisponible (maintenance / bloquée / hors service).'})
    if room_has_conflict(room, check_in, check_out, exclude_reservation_id):
        raise ValidationError({'room': 'Conflit : chambre déjà réservée sur ces dates.'})


def compute_total(amount_per_night, check_in, check_out):
    nights = max((check_out - check_in).days, 0)
    return Decimal(amount_per_night or 0) * nights, nights


def available_rooms(hotel, room_type_id, check_in, check_out, exclude_reservation_id=None):
    """
    Chambres libres sur la période.
    Pour une arrivée aujourd'hui / passée : housekeeping READY ou CLEAN obligatoire.
    Réservations futures : on peut proposer une chambre encore en ménage (sera prête avant).
    """
    rooms = Room.objects.filter(
        hotel=hotel,
        room_type_id=room_type_id,
        is_active=True,
    ).exclude(operational_status__in=('MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE', 'OCCUPIED', 'CLEANING'))
    free = []
    today = date.today()
    for room in rooms:
        # Arrivée immédiate : chambre doit être prête (après ménage + validation)
        if check_in <= today and room.housekeeping_status not in ('READY', 'CLEAN'):
            continue
        # Même hors arrivée immédiate : statut HK bloquant (hors service)
        if room.housekeeping_status in ('OUT_OF_SERVICE',):
            continue
        if not room_has_conflict(room, check_in, check_out, exclude_reservation_id):
            free.append(room)
    return free


@transaction.atomic
def check_in_reservation(reservation, room, actor, walk_in=False):
    if reservation.status in ('CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'):
        raise ValidationError({'status': 'Réservation non éligible au check-in.'})
    # Flux métier : Client → Réservations (confirm) → Réception (check-in)
    if not walk_in and reservation.status not in ('CONFIRMED', 'EXPECTED'):
        raise ValidationError({
            'status': (
                'Confirmez d\'abord la réservation (menu Réservations) '
                'avant le check-in à la réception.'
            ),
        })
    if not room:
        raise ValidationError({'room': 'Chambre obligatoire pour le check-in.'})
    assert_room_assignable(room, reservation.check_in_date, reservation.check_out_date, reservation.id)
    if room.housekeeping_status not in ('READY', 'CLEAN'):
        raise ValidationError({'room': 'Chambre non prête (housekeeping).'})

    reservation.room = room
    reservation.status = 'CHECKED_IN'
    reservation.save(update_fields=['room', 'status', 'updated_at'])

    room.operational_status = 'OCCUPIED'
    room.housekeeping_status = 'OCCUPIED'
    room.save(update_fields=['operational_status', 'housekeeping_status'])

    stay = Stay.objects.create(
        reservation=reservation,
        hotel=reservation.hotel,
        guest=reservation.guest,
        room=room,
        actual_check_in=timezone.now(),
        status='IN_HOUSE',
    )
    folio = Folio.objects.create(
        stay=stay,
        guest=reservation.guest,
        currency=getattr(getattr(reservation.hotel, 'hotel_profile', None), 'currency', None) or 'BIF',
    )
    nights = reservation.nights or 1
    FolioItem.objects.create(
        folio=folio,
        item_type='NIGHT',
        description=f'Nuitées × {nights} ({room.number})',
        quantity=nights,
        unit_price=reservation.amount_per_night,
        added_by=actor,
    )
    folio.recalculate()
    audit(reservation.hotel, actor, 'CHECK_IN', 'Stay', stay.id, new={'room': room.number})
    return stay


@transaction.atomic
def add_service_to_stay(stay, hotel_service, quantity, actor):
    folio = stay.folio
    if folio.status != 'OPEN':
        raise ValidationError({'folio': 'Folio fermé.'})
    qty = Decimal(str(quantity or 1))
    FolioItem.objects.create(
        folio=folio,
        item_type='SERVICE',
        description=hotel_service.name,
        quantity=qty,
        unit_price=hotel_service.unit_price,
        hotel_service=hotel_service,
        added_by=actor,
    )
    folio.recalculate()
    audit(stay.hotel, actor, 'ADD_SERVICE', 'Folio', folio.id, new={'service': hotel_service.name, 'qty': str(qty)})
    return folio


def assert_cash_day_open(hotel, on_date=None):
    """Refuse les encaissements si la journée est déjà clôturée."""
    from .models import CashClosing
    day = on_date or timezone.localdate()
    if CashClosing.objects.filter(hotel=hotel, period_date=day, is_locked=True).exists():
        raise ValidationError({
            'cash_closing': f'Caisse clôturée pour le {day}. Réouverture impossible — choisissez un autre jour ou contactez le manager.',
        })


@transaction.atomic
def record_payment(folio, amount, method, actor, reference='', notes=''):
    if folio.status != 'OPEN':
        raise ValidationError({'folio': 'Folio fermé.'})
    assert_cash_day_open(folio.stay.hotel)
    from .models import Payment
    payment = Payment.objects.create(
        folio=folio,
        amount=Decimal(str(amount)),
        method=method or 'CASH',
        status='PAID',
        reference=reference or '',
        received_by=actor,
        notes=notes or '',
    )
    folio.recalculate()
    audit(folio.stay.hotel, actor, 'PAYMENT', 'Payment', payment.id, new={'amount': str(payment.amount)})
    return payment


@transaction.atomic
def check_out_stay(stay, actor, allow_balance=False):
    if stay.status != 'IN_HOUSE':
        raise ValidationError({'status': 'Séjour déjà clôturé.'})
    folio = stay.folio
    folio.recalculate()
    if folio.balance > 0 and not allow_balance:
        raise ValidationError({'balance': f'Solde impayé : {folio.balance}. Règlement requis ou autorisation manager.'})

    items = [
        {
            'type': i.item_type,
            'description': i.description,
            'quantity': str(i.quantity),
            'unit_price': str(i.unit_price),
            'total': str(i.total),
        }
        for i in folio.items.all()
    ]
    inv = HotelInvoice.objects.create(
        number=next_reference(stay.hotel, 'INV'),
        hotel=stay.hotel,
        stay=stay,
        folio=folio,
        guest_name=f'{stay.guest.first_name} {stay.guest.last_name}',
        period_start=stay.reservation.check_in_date,
        period_end=stay.reservation.check_out_date,
        subtotal=folio.subtotal,
        taxes=folio.taxes,
        discounts=folio.discounts,
        total=folio.total,
        paid_amount=folio.paid_amount,
        balance=folio.balance,
        currency=folio.currency,
        status='PAID' if folio.balance <= 0 else 'PARTIAL',
        snapshot={'items': items},
        issued_by=actor,
    )
    folio.status = 'CLOSED'
    folio.save(update_fields=['status', 'updated_at'])

    stay.status = 'CHECKED_OUT'
    stay.actual_check_out = timezone.now()
    stay.save(update_fields=['status', 'actual_check_out'])

    stay.reservation.status = 'CHECKED_OUT'
    stay.reservation.save(update_fields=['status', 'updated_at'])

    room = stay.room
    # Pas encore revendable : ménage obligatoire avant check-in suivant
    room.operational_status = 'CLEANING'
    room.housekeeping_status = 'CLEANING_REQUIRED'
    room.save(update_fields=['operational_status', 'housekeeping_status'])

    task = HousekeepingTask.objects.create(
        hotel=stay.hotel,
        room=room,
        task_type='CLEANING',
        priority='HIGH',
        status='PENDING',
        comment=f'Après départ {stay.guest}',
    )
    from .housekeeping_notifications import notify_cleaning_required
    hk_notify = notify_cleaning_required(
        stay.hotel, room, task=task, stay=stay, reason='checkout',
    )
    audit(
        stay.hotel, actor, 'CHECK_OUT', 'Stay', stay.id,
        new={'invoice': inv.number, 'hk_task': str(task.id), 'hk_notify': hk_notify.get('ok')},
    )
    inv._hk_notification = hk_notify  # attach for API response
    return inv


@transaction.atomic
def mark_reservation_no_show(reservation, *, actor=None, note=''):
    """
    Marque une réservation confirmée / attendue comme NO_SHOW.
    Libère la chambre réservée et exige un remboursement si PAID.
    """
    if reservation.status in ('NO_SHOW',):
        return reservation
    if reservation.status in ('CHECKED_IN', 'CHECKED_OUT'):
        raise ValidationError({'status': 'No-show impossible après check-in / check-out.'})
    if reservation.status in ('CANCELLED', 'EXPIRED'):
        raise ValidationError({'status': 'Réservation déjà annulée ou expirée.'})
    if reservation.status not in ('CONFIRMED', 'EXPECTED', 'PENDING', 'DRAFT'):
        raise ValidationError({
            'status': f'Statut incompatible pour un no-show ({reservation.status}).',
        })

    from .reservation_payment import ensure_refunded_before_cancel
    refund_gate = ensure_refunded_before_cancel(reservation)
    if not refund_gate.get('ok'):
        raise ValidationError({
            'payment_status': refund_gate.get('message') or 'Remboursez d’abord le client.',
            'code': refund_gate.get('code') or 'REFUND_REQUIRED',
        })

    previous = reservation.status
    reservation.status = 'NO_SHOW'
    motif = (note or 'Client non présenté (no-show)').strip()[:2000]
    reservation.decision_note = motif
    reservation.decision_at = timezone.now()
    from .client_messages import append_hotel_history_line
    author = ''
    if actor is not None:
        author = (
            (getattr(actor, 'first_name', None) or '')
            or (getattr(actor, 'email', None) or '')
            or 'Hôtel'
        ).strip()
    append_hotel_history_line(reservation, f'No-show : {motif}', author=author or 'Hôtel')
    reservation.save(update_fields=[
        'status', 'decision_note', 'decision_at', 'special_requests', 'updated_at',
    ])

    if reservation.room_id:
        room = reservation.room
        if room.operational_status in ('RESERVED', 'OCCUPIED'):
            # Pas de séjour actif : remettre disponible / prêt ménage si besoin
            room.operational_status = 'AVAILABLE'
            if room.housekeeping_status in ('OCCUPIED',):
                room.housekeeping_status = 'CLEANING_REQUIRED'
            room.save(update_fields=['operational_status', 'housekeeping_status'])

    audit(
        reservation.hotel, actor, 'NO_SHOW', 'Reservation', reservation.id,
        old={'status': previous},
        new={'status': 'NO_SHOW', 'note': motif[:200]},
    )
    return reservation
