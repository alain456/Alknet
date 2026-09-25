"""Paiement commande Commerce : client → marchand de la boutique (BurundiPay)."""
from __future__ import annotations

from django.utils import timezone

from businesses import burundipay


def shop_merchant_account(business) -> str:
    if not business:
        return 'COMMERCE_MERCHANT'
    configured = (getattr(business, 'lumicash_merchant_account', None) or '').strip()
    if configured:
        return configured
    return f'COM-{str(business.id).replace("-", "")[:10].upper()}'


def order_is_payment_settled(order) -> bool:
    return order.payment_status == 'PAID'


def initiate_order_payment(order, payer_phone: str) -> dict:
    if order_is_payment_settled(order):
        return {
            'ok': True,
            'already_paid': True,
            'message': 'Commande déjà payée.',
            'order': order,
        }

    try:
        amount = int(round(float(order.total_amount or 0)))
    except (TypeError, ValueError):
        amount = 0

    if amount <= 0:
        order.payment_status = 'PAID'
        order.payment_method = 'FREE'
        order.paid_at = timezone.now()
        order.payment_note = 'Commande sans frais'
        order.save(update_fields=[
            'payment_status', 'payment_method', 'paid_at', 'payment_note', 'updated_at',
        ])
        return {
            'ok': True,
            'already_paid': True,
            'message': 'Aucun montant à payer.',
            'order': order,
        }

    merchant = shop_merchant_account(order.business)
    result = burundipay.initiate_collection(
        amount_bif=amount,
        payer_phone=payer_phone,
        external_id=f'commerce-{order.id}',
        description=f'Commande {order.reference_code or order.id} — {order.business.name}',
        merchant=merchant,
    )
    order.payer_phone = burundipay.normalize_phone(payer_phone)
    order.payment_merchant_account = merchant
    order.payment_method = 'BURUNDIPAY'
    if result.get('ok'):
        order.payment_status = 'AWAITING_PIN'
        order.payment_provider_reference = result.get('provider_reference') or ''
        order.payment_note = result.get('message') or ''
    else:
        order.payment_status = 'FAILED'
        order.payment_note = result.get('message') or 'Échec initiation paiement'
    order.save(update_fields=[
        'payer_phone', 'payment_merchant_account', 'payment_method',
        'payment_status', 'payment_provider_reference', 'payment_note', 'updated_at',
    ])
    return {**result, 'order': order}


def confirm_order_payment_stub(order) -> dict:
    """Simulation PIN (dev) — même pattern que retail."""
    if order.payment_status == 'PAID':
        return {'ok': True, 'already_paid': True, 'order': order}
    if order.payment_status not in ('AWAITING_PIN', 'UNPAID', 'FAILED'):
        return {'ok': False, 'message': 'Statut paiement incompatible.', 'order': order}
    order.payment_status = 'PAID'
    order.paid_at = timezone.now()
    order.payment_note = 'Paiement confirmé (simulation PIN)'
    order.save(update_fields=['payment_status', 'paid_at', 'payment_note', 'updated_at'])
    return {'ok': True, 'order': order}


def mark_order_paid_manual(order, *, note='Confirmé en caisse') -> dict:
    order.payment_status = 'PAID'
    order.payment_method = order.payment_method or 'CASH'
    order.paid_at = timezone.now()
    order.payment_note = note
    order.save(update_fields=[
        'payment_status', 'payment_method', 'paid_at', 'payment_note', 'updated_at',
    ])
    return {'ok': True, 'order': order}
