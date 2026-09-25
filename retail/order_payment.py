"""
Paiement commande pharmacie de détail : client → compte marchand de la pharmacie (BurundiPay).
Même schéma que hospital/appointment_payment.py (consultation).
"""
from __future__ import annotations

from django.utils import timezone

from businesses import burundipay


def pharmacy_merchant_account(business) -> str:
    if not business:
        return 'RETAIL_MERCHANT'
    configured = (getattr(business, 'lumicash_merchant_account', None) or '').strip()
    if configured:
        return configured
    return f'RETAIL-{str(business.id).replace("-", "")[:10].upper()}'


def order_is_payment_settled(order) -> bool:
    return order.payment_status == 'PAID'


def initiate_order_payment(order, payer_phone: str) -> dict:
    """Initie un débit BurundiPay vers le marchand de la pharmacie."""
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

    merchant = pharmacy_merchant_account(order.retail_business)
    result = burundipay.initiate_collection(
        amount_bif=amount,
        payer_phone=payer_phone,
        external_id=f'retail-{order.id}',
        description=(
            f'Commande {order.reference or order.id} — '
            f'{order.retail_business.name}'
        ),
        merchant=merchant,
    )

    order.payer_phone = burundipay.normalize_phone(payer_phone)
    order.payment_method = 'BURUNDIPAY'
    order.payment_merchant_account = merchant
    order.payment_provider_reference = result.get('provider_reference') or ''
    if result.get('ok'):
        order.payment_status = result.get('status') or 'AWAITING_PIN'
        order.payment_note = ''
    else:
        order.payment_status = 'FAILED'
        order.payment_note = result.get('message') or 'Échec initiation BurundiPay'
    order.save(update_fields=[
        'payer_phone', 'payment_method', 'payment_merchant_account',
        'payment_provider_reference', 'payment_status', 'payment_note', 'updated_at',
    ])

    return {
        'ok': bool(result.get('ok')),
        'already_paid': False,
        'message': result.get('message') or '',
        'stub_mode': burundipay.is_stub_mode(),
        'provider_reference': order.payment_provider_reference,
        'merchant_account': merchant,
        'amount_bif': amount,
        'currency': order.currency or 'BIF',
        'order': order,
    }


def confirm_order_payment_stub(order) -> dict:
    """Confirme le paiement en mode simulation BurundiPay."""
    if not burundipay.is_stub_mode():
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
    order.payment_method = order.payment_method or 'BURUNDIPAY'
    order.payment_note = 'Paiement confirmé (simulation BurundiPay)'
    order.save(update_fields=[
        'payment_status', 'paid_at', 'payment_method', 'payment_note', 'updated_at',
    ])
    return {
        'ok': True,
        'message': 'Paiement commande confirmé (simulation). Vous pouvez récupérer vos médicaments après acceptation par la pharmacie.',
        'order': order,
    }
