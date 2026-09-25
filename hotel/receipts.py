"""Reçu de paiement folio (données pour affichage / impression)."""
from __future__ import annotations

from django.utils import timezone


METHOD_LABELS = {
    'CASH': 'Espèces',
    'TRANSFER': 'Virement',
    'CARD': 'Carte',
    'MOBILE_MONEY': 'Mobile money',
    'BURUNDIPAY': 'BurundiPay',
    'OTHER': 'Autre',
}


def build_payment_receipt(payment) -> dict:
    folio = payment.folio
    stay = folio.stay
    hotel = stay.hotel
    guest = folio.guest
    profile = getattr(hotel, 'hotel_profile', None)
    trade = (getattr(profile, 'trade_name', None) or '').strip() if profile else ''
    hotel_name = trade or hotel.name or 'Hôtel'
    guest_name = ''
    if guest:
        guest_name = f'{guest.first_name or ""} {guest.last_name or ""}'.strip()
    room_number = stay.room.number if stay.room_id else ''
    reservation_ref = stay.reservation.reference if stay.reservation_id else ''
    receipt_number = f"REC-{str(payment.id).replace('-', '')[:10].upper()}"

    items = [
        {
            'description': i.description,
            'quantity': str(i.quantity),
            'unit_price': str(i.unit_price),
            'total': str(i.total),
        }
        for i in folio.items.all()
    ]

    return {
        'receipt_number': receipt_number,
        'issued_at': timezone.now().isoformat(),
        'hotel': {
            'name': hotel_name,
            'phone': hotel.phone or '',
            'email': hotel.email or '',
        },
        'guest': {
            'name': guest_name,
            'phone': (guest.phone if guest else '') or '',
            'email': (guest.email if guest else '') or '',
        },
        'stay': {
            'reservation_ref': reservation_ref,
            'room_number': room_number,
            'check_in': str(stay.reservation.check_in_date) if stay.reservation_id else '',
            'check_out': str(stay.reservation.check_out_date) if stay.reservation_id else '',
            'status': stay.status,
        },
        'folio': {
            'id': str(folio.id),
            'status': folio.status,
            'subtotal': str(folio.subtotal),
            'taxes': str(folio.taxes),
            'discounts': str(folio.discounts),
            'total': str(folio.total),
            'paid_amount': str(folio.paid_amount),
            'balance': str(folio.balance),
            'currency': folio.currency or 'BIF',
            'items': items,
        },
        'payment': {
            'id': str(payment.id),
            'amount': str(payment.amount),
            'method': payment.method,
            'method_label': METHOD_LABELS.get(payment.method, payment.method),
            'status': payment.status,
            'reference': payment.reference or '',
            'paid_at': payment.paid_at.isoformat() if payment.paid_at else '',
            'notes': payment.notes or '',
        },
    }
