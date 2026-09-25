"""Paiement BurundiPay sur folio séjour (caisse)."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from businesses import burundipay

from .reservation_payment import hotel_merchant_account
from .services import assert_cash_day_open, audit


def _amount(value) -> Decimal:
    try:
        amt = Decimal(str(value))
    except Exception as exc:
        raise ValidationError({'amount': 'Montant invalide.'}) from exc
    if amt <= 0:
        raise ValidationError({'amount': 'Montant doit être positif.'})
    return amt.quantize(Decimal('0.01'))


@transaction.atomic
def initiate_folio_burundipay(folio, amount, payer_phone: str, actor) -> dict:
    if folio.status != 'OPEN':
        raise ValidationError({'folio': 'Folio fermé.'})
    assert_cash_day_open(folio.stay.hotel)

    folio.recalculate()
    amt = _amount(amount if amount is not None else folio.balance)
    if amt > folio.balance:
        raise ValidationError({'amount': f'Montant supérieur au solde ({folio.balance}).'})

    phone = burundipay.normalize_phone(payer_phone)
    if not phone:
        raise ValidationError({'payer_phone': 'Numéro BurundiPay invalide.'})

    # Annuler d’éventuels paiements PIN en attente sur ce folio
    from .models import Payment
    Payment.objects.filter(
        folio=folio, method='BURUNDIPAY', status='AWAITING_PIN',
    ).update(status='CANCELLED', notes='Remplacé par une nouvelle initiation BurundiPay')

    merchant = hotel_merchant_account(folio.stay.hotel)
    stay = folio.stay
    ref = stay.reservation.reference if stay.reservation_id else str(folio.id)[:8]
    result = burundipay.initiate_collection(
        amount_bif=int(round(float(amt))),
        payer_phone=phone,
        external_id=f'folio-{folio.id}-{timezone.now().strftime("%H%M%S")}',
        description=f'Folio séjour {ref} — {folio.stay.hotel.name}',
        merchant=merchant,
    )

    payment = Payment.objects.create(
        folio=folio,
        amount=amt,
        method='BURUNDIPAY',
        status='AWAITING_PIN' if result.get('ok') else 'FAILED',
        reference=result.get('provider_reference') or '',
        received_by=actor,
        notes=(
            f'BurundiPay {phone} → {merchant}'
            if result.get('ok')
            else (result.get('message') or 'Échec initiation BurundiPay')
        ),
        paid_at=timezone.now(),
    )
    audit(
        folio.stay.hotel, actor, 'FOLIO_BURUNDIPAY_INIT', 'Payment', payment.id,
        new={'amount': str(amt), 'phone': phone, 'ok': bool(result.get('ok'))},
    )
    return {
        'ok': bool(result.get('ok')),
        'message': result.get('message') or (
            'Demande envoyée — validez le PIN BurundiPay.' if result.get('ok') else 'Échec'
        ),
        'stub_mode': burundipay.is_stub_mode(),
        'provider_reference': payment.reference,
        'merchant_account': merchant,
        'amount': str(amt),
        'currency': folio.currency or 'BIF',
        'payer_phone': phone,
        'payment': payment,
        'folio': folio,
    }


@transaction.atomic
def confirm_folio_burundipay_stub(payment, actor) -> dict:
    """Simulation PIN — mode stub uniquement."""
    if not burundipay.is_stub_mode():
        return {
            'ok': False,
            'message': 'Confirmation manuelle réservée au mode simulation.',
            'payment': payment,
        }
    if payment.method != 'BURUNDIPAY':
        raise ValidationError({'method': 'Paiement non BurundiPay.'})
    if payment.status == 'PAID':
        return {'ok': True, 'already_paid': True, 'message': 'Déjà confirmé.', 'payment': payment}
    if payment.status not in ('AWAITING_PIN', 'PENDING', 'FAILED'):
        raise ValidationError({'status': f'Statut incompatible : {payment.status}.'})

    folio = payment.folio
    assert_cash_day_open(folio.stay.hotel)
    if folio.status != 'OPEN':
        raise ValidationError({'folio': 'Folio fermé.'})

    payment.status = 'PAID'
    payment.paid_at = timezone.now()
    payment.notes = (payment.notes or '').strip()
    if 'confirmé' not in payment.notes.lower():
        payment.notes = f'{payment.notes} · Confirmé (simulation PIN)'.strip(' ·')
    payment.received_by = actor or payment.received_by
    payment.save(update_fields=['status', 'paid_at', 'notes', 'received_by'])
    folio.recalculate()
    audit(
        folio.stay.hotel, actor, 'FOLIO_BURUNDIPAY_CONFIRM', 'Payment', payment.id,
        new={'amount': str(payment.amount)},
    )
    return {
        'ok': True,
        'already_paid': False,
        'message': 'Paiement BurundiPay confirmé (simulation).',
        'stub_mode': True,
        'payment': payment,
        'folio': folio,
    }
