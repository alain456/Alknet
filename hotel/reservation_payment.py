"""
Paiement réservation hôtel : client → compte marchand de l'hôtel (BurundiPay).
Montant = total_amount figé à la création. Distinct du folio séjour (caisse).
"""
from __future__ import annotations

from django.utils import timezone

from businesses import burundipay


def hotel_merchant_account(hotel) -> str:
    if not hotel:
        return 'HOTEL_MERCHANT'
    configured = (getattr(hotel, 'lumicash_merchant_account', None) or '').strip()
    if configured:
        return configured
    return f'HOTEL-{str(hotel.id).replace("-", "")[:10].upper()}'


def apply_payment_snapshot(reservation) -> None:
    """Initialise le statut paiement selon le total (appelé à la création)."""
    try:
        amount = int(round(float(reservation.total_amount or 0)))
    except (TypeError, ValueError):
        amount = 0
    reservation.currency = reservation.currency or 'BIF'
    reservation.payment_merchant_account = hotel_merchant_account(reservation.hotel)
    if amount <= 0:
        reservation.payment_status = 'PAID'
        reservation.payment_method = 'FREE'
        reservation.paid_at = timezone.now()
        reservation.payment_note = 'Réservation sans frais'
    else:
        reservation.payment_status = 'UNPAID'


def reservation_is_payment_settled(reservation) -> bool:
    return reservation.payment_status in ('PAID', 'WAIVED')


def initiate_reservation_payment(reservation, payer_phone: str) -> dict:
    if reservation_is_payment_settled(reservation):
        return {
            'ok': True,
            'already_paid': True,
            'message': 'Réservation déjà payée ou exonérée.',
            'reservation': reservation,
        }

    try:
        amount = int(round(float(reservation.total_amount or 0)))
    except (TypeError, ValueError):
        amount = 0

    if amount <= 0:
        reservation.payment_status = 'PAID'
        reservation.payment_method = 'FREE'
        reservation.paid_at = timezone.now()
        reservation.save(update_fields=[
            'payment_status', 'payment_method', 'paid_at', 'updated_at',
        ])
        return {
            'ok': True,
            'already_paid': True,
            'message': 'Aucun montant à payer.',
            'reservation': reservation,
        }

    merchant = hotel_merchant_account(reservation.hotel)
    result = burundipay.initiate_collection(
        amount_bif=amount,
        payer_phone=payer_phone,
        external_id=f'res-{reservation.id}',
        description=(
            f'Réservation {reservation.reference} — {reservation.hotel.name}'
        ),
        merchant=merchant,
    )

    reservation.payer_phone = burundipay.normalize_phone(payer_phone)
    reservation.payment_method = 'BURUNDIPAY'
    reservation.payment_merchant_account = merchant
    reservation.payment_provider_reference = result.get('provider_reference') or ''
    if result.get('ok'):
        reservation.payment_status = result.get('status') or 'AWAITING_PIN'
        reservation.payment_note = ''
    else:
        reservation.payment_status = 'FAILED'
        reservation.payment_note = result.get('message') or 'Échec initiation BurundiPay'
    reservation.save(update_fields=[
        'payer_phone', 'payment_method', 'payment_merchant_account',
        'payment_provider_reference', 'payment_status', 'payment_note', 'updated_at',
    ])

    return {
        'ok': bool(result.get('ok')),
        'already_paid': False,
        'message': result.get('message') or '',
        'stub_mode': burundipay.is_stub_mode(),
        'provider_reference': reservation.payment_provider_reference,
        'merchant_account': merchant,
        'amount_bif': amount,
        'currency': reservation.currency or 'BIF',
        'reservation': reservation,
    }


def confirm_reservation_payment_stub(reservation) -> dict:
    """
    Simulation PIN BurundiPay (comme commandes / RDV).
    Autorisé pour AWAITING_PIN, UNPAID et FAILED.
    En mode live : délègue au polling statut (pas de confirmation manuelle).
    """
    from businesses import burundipay

    if not burundipay.is_stub_mode():
        return sync_reservation_payment_status(reservation)

    if reservation.payment_status == 'PAID':
        return {'ok': True, 'message': 'Déjà payé.', 'reservation': reservation}
    if reservation.payment_status == 'WAIVED':
        return {'ok': True, 'message': 'Réservation exonérée.', 'reservation': reservation}
    if reservation.payment_status not in ('AWAITING_PIN', 'UNPAID', 'FAILED'):
        return {
            'ok': False,
            'message': f'Statut paiement incompatible: {reservation.payment_status}',
            'reservation': reservation,
        }

    reservation.payment_status = 'PAID'
    reservation.paid_at = timezone.now()
    reservation.payment_method = reservation.payment_method or 'BURUNDIPAY'
    reservation.payment_note = 'Paiement confirmé (simulation BurundiPay)'
    if not (reservation.payer_phone or '').strip():
        reservation.payer_phone = '25700000000'
    reservation.save(update_fields=[
        'payment_status', 'paid_at', 'payment_method', 'payment_note',
        'payer_phone', 'updated_at',
    ])
    return {
        'ok': True,
        'message': 'Paiement réservation confirmé (simulation).',
        'reservation': reservation,
    }


def sync_reservation_payment_status(reservation) -> dict:
    """Live : interroge BurundiPay et marque PAID / FAILED si le statut a changé."""
    from businesses import burundipay

    if reservation.payment_status == 'PAID':
        return {'ok': True, 'message': 'Déjà payé.', 'reservation': reservation}
    if reservation.payment_status == 'WAIVED':
        return {'ok': True, 'message': 'Réservation exonérée.', 'reservation': reservation}
    if reservation.payment_status == 'REFUNDED':
        return {'ok': True, 'message': 'Déjà remboursé.', 'reservation': reservation}

    result = burundipay.check_collection_status(
        provider_reference=reservation.payment_provider_reference or '',
        external_id=f'res-{reservation.id}',
    )
    status = (result.get('status') or '').upper()
    if result.get('provider_reference') and not reservation.payment_provider_reference:
        reservation.payment_provider_reference = result['provider_reference']

    if status == 'PAID':
        reservation.payment_status = 'PAID'
        reservation.paid_at = timezone.now()
        reservation.payment_method = reservation.payment_method or 'BURUNDIPAY'
        reservation.payment_note = (result.get('message') or 'Confirmé via BurundiPay')[:255]
        reservation.save(update_fields=[
            'payment_status', 'paid_at', 'payment_method', 'payment_note',
            'payment_provider_reference', 'updated_at',
        ])
        return {
            'ok': True,
            'message': 'Paiement confirmé via BurundiPay.',
            'reservation': reservation,
            'stub_mode': False,
        }

    if status == 'FAILED':
        reservation.payment_status = 'FAILED'
        reservation.payment_note = (result.get('message') or 'Échec BurundiPay')[:255]
        reservation.save(update_fields=[
            'payment_status', 'payment_note', 'payment_provider_reference', 'updated_at',
        ])
        return {
            'ok': False,
            'message': reservation.payment_note,
            'reservation': reservation,
            'stub_mode': False,
        }

    reservation.payment_status = 'AWAITING_PIN'
    reservation.payment_note = (result.get('message') or 'En attente validation client')[:255]
    reservation.save(update_fields=[
        'payment_status', 'payment_note', 'payment_provider_reference', 'updated_at',
    ])
    return {
        'ok': False,
        'message': (
            result.get('message')
            or 'Paiement encore en attente. Le client doit valider sur BurundiPay.'
        ),
        'reservation': reservation,
        'stub_mode': False,
    }


def refund_reservation_payment(reservation, *, note='', actor=None) -> dict:
    """Rembourse réellement via BurundiPay (stub ou live), puis marque REFUNDED."""
    from businesses import burundipay

    try:
        amount = int(round(float(reservation.total_amount or 0)))
    except (TypeError, ValueError):
        amount = 0
    if amount <= 0:
        reservation.payment_status = 'REFUNDED'
        reservation.payment_note = (note or 'Aucun montant à rembourser').strip()[:255]
        reservation.save(update_fields=['payment_status', 'payment_note', 'updated_at'])
        return {'ok': True, 'message': 'Aucun montant à rembourser.', 'reservation': reservation}

    if reservation.payment_status == 'REFUNDED':
        return {'ok': True, 'already_refunded': True, 'message': 'Déjà remboursé.', 'reservation': reservation}

    if reservation.payment_status not in ('PAID',):
        return {
            'ok': False,
            'message': (
                f'Seul un paiement « Payé » peut être remboursé '
                f'(statut actuel : {reservation.payment_status}).'
            ),
            'reservation': reservation,
        }

    actor_label = ''
    if actor is not None:
        actor_label = getattr(actor, 'email', None) or str(actor)

    method = (reservation.payment_method or '').upper()
    is_provider = burundipay.is_burundipay_method(method) or bool(reservation.payment_provider_reference)

    if is_provider:
        result = burundipay.refund_collection(
            amount_bif=amount,
            payer_phone=reservation.payer_phone or '',
            provider_reference=reservation.payment_provider_reference or '',
            external_id=f'res-{reservation.id}',
            description=(
                f'Remboursement réservation {reservation.reference} — '
                f'{getattr(reservation.hotel, "name", "hôtel")}'
            ),
            merchant=reservation.payment_merchant_account or hotel_merchant_account(reservation.hotel),
        )
        if not result.get('ok'):
            return {
                'ok': False,
                'message': result.get('message') or 'Échec remboursement BurundiPay.',
                'reservation': reservation,
                'provider': result,
            }
    else:
        # Espèces / marque manuelle : pas d’appel réseau
        result = {
            'ok': True,
            'message': 'Remboursement manuel enregistré (hors BurundiPay).',
            'refund_reference': '',
            'stub_mode': False,
        }

    parts = [
        f'Remboursement {amount} {reservation.currency or "BIF"}',
        f'→ {reservation.payer_phone or "client"}',
    ]
    if result.get('refund_reference'):
        parts.append(f'ref {result["refund_reference"]}')
    if result.get('stub_mode'):
        parts.append('SIMULATION BurundiPay')
    else:
        parts.append('BurundiPay live')
    if note:
        parts.append(note.strip())
    if actor_label:
        parts.append(f'[{actor_label}]')

    reservation.payment_status = 'REFUNDED'
    reservation.payment_note = ' — '.join(parts)[:255]
    reservation.save(update_fields=['payment_status', 'payment_note', 'updated_at'])
    return {
        'ok': True,
        'message': result.get('message') or (
            'Paiement remboursé. Vous pouvez maintenant refuser la réservation.'
        ),
        'reservation': reservation,
        'stub_mode': bool(result.get('stub_mode')),
        'refund_reference': result.get('refund_reference') or '',
    }


def ensure_payment_settled_for_confirm(reservation, *, allow_stub_simulate=False) -> dict:
    """
    Avant confirmation métier : le client doit déjà avoir payé les frais de réservation.
    Pas de simulation automatique au moment de confirmer.
    """
    try:
        amount = int(round(float(reservation.total_amount or 0)))
    except (TypeError, ValueError):
        amount = 0

    if amount <= 0 or reservation_is_payment_settled(reservation):
        return {'ok': True, 'simulated': False, 'message': '', 'reservation': reservation}

    if allow_stub_simulate:
        from businesses import burundipay
        if burundipay.is_stub_mode():
            result = confirm_reservation_payment_stub(reservation)
            reservation.refresh_from_db()
            return {
                'ok': bool(result.get('ok')),
                'simulated': True,
                'message': result.get('message') or '',
                'reservation': reservation,
            }

    return {
        'ok': False,
        'simulated': False,
        'message': (
            'Le client doit d\'abord payer les frais de réservation '
            f'(statut actuel : {reservation.payment_status}). '
            'Utilisez « Simuler paiement (PIN) » ou relancez BurundiPay, puis confirmez.'
        ),
        'reservation': reservation,
    }


def mark_reservation_paid_by_staff(reservation, *, method='CASH', note='', actor=None) -> dict:
    reservation.payment_status = 'PAID'
    reservation.paid_at = timezone.now()
    reservation.payment_method = (method or 'CASH').upper()[:40]
    reservation.payment_note = (note or 'Marqué payé par le personnel').strip()[:255]
    reservation.save(update_fields=[
        'payment_status', 'paid_at', 'payment_method', 'payment_note', 'updated_at',
    ])
    return {'ok': True, 'message': 'Réservation marquée payée.', 'reservation': reservation}


def reservation_requires_refund_before_cancel(reservation) -> bool:
    """True si un paiement client a été encaissé et n'a pas encore été remboursé."""
    try:
        amount = float(reservation.total_amount or 0)
    except (TypeError, ValueError):
        amount = 0
    if amount <= 0:
        return False
    if reservation.payment_status == 'REFUNDED':
        return False
    if reservation.payment_status == 'WAIVED':
        return False
    return reservation.payment_status == 'PAID'


def ensure_refunded_before_cancel(reservation) -> dict:
    """
    Bloque le refus / annulation tant que le paiement n'est pas remboursé.
    """
    if not reservation_requires_refund_before_cancel(reservation):
        return {'ok': True, 'reservation': reservation}
    return {
        'ok': False,
        'code': 'REFUND_REQUIRED',
        'message': (
            'Remboursez d’abord le client (statut paiement → Remboursé) '
            'avant de refuser ou d’annuler cette réservation.'
        ),
        'reservation': reservation,
    }
