"""
Paiement commande pharmacie de gros : acheteur → compte marchand du grossiste (Lumicash).
"""
from __future__ import annotations

from django.utils import timezone

from businesses import lumicash


def pharmacy_merchant_account(business) -> str:
    if not business:
        return 'WHOLESALE_MERCHANT'
    configured = (getattr(business, 'lumicash_merchant_account', None) or '').strip()
    if configured:
        return configured
    return f'WHOLE-{str(business.id).replace("-", "")[:10].upper()}'


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

    merchant = pharmacy_merchant_account(order.wholesale_business)
    result = lumicash.initiate_collection(
        amount_bif=amount,
        payer_phone=payer_phone,
        external_id=f'wholesale-{order.id}',
        description=(
            f'Commande {order.reference or order.id} — '
            f'{order.wholesale_business.name}'
        ),
        merchant=merchant,
    )

    order.payer_phone = lumicash.normalize_phone(payer_phone)
    order.payment_method = 'LUMICASH'
    order.payment_merchant_account = merchant
    order.payment_provider_reference = result.get('provider_reference') or ''
    if result.get('ok'):
        order.payment_status = result.get('status') or 'AWAITING_PIN'
        order.payment_note = ''
    else:
        order.payment_status = 'FAILED'
        order.payment_note = result.get('message') or 'Échec initiation Lumicash'
    order.save(update_fields=[
        'payer_phone', 'payment_method', 'payment_merchant_account',
        'payment_provider_reference', 'payment_status', 'payment_note', 'updated_at',
    ])

    return {
        'ok': bool(result.get('ok')),
        'already_paid': False,
        'message': result.get('message') or '',
        'stub_mode': lumicash.is_stub_mode(),
        'provider_reference': order.payment_provider_reference,
        'merchant_account': merchant,
        'amount_bif': amount,
        'currency': order.currency or 'BIF',
        'order': order,
    }


def confirm_order_payment_stub(order) -> dict:
    if not lumicash.is_stub_mode():
        return {
            'ok': False,
            'message': 'Confirmation manuelle réservée au mode simulation.',
            'order': order,
        }
    if order.payment_status == 'PAID':
        return {'ok': True, 'message': 'Déjà payé.', 'order': order}
    if order.payment_status not in ('AWAITING_PIN', 'UNPAID', 'FAILED'):
        return {
            'ok': False,
            'message': f'Statut paiement incompatible: {order.payment_status}',
            'order': order,
        }

    order.payment_status = 'PAID'
    order.paid_at = timezone.now()
    order.payment_method = order.payment_method or 'LUMICASH'
    order.payment_note = 'Paiement confirmé (simulation Lumicash)'
    order.save(update_fields=[
        'payment_status', 'paid_at', 'payment_method', 'payment_note', 'updated_at',
    ])
    return {
        'ok': True,
        'message': 'Paiement commande confirmé (simulation). Récupérez les produits après acceptation par le grossiste.',
        'order': order,
    }
