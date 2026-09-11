"""Emails workflow commandes Commerce."""
from __future__ import annotations

from django.conf import settings
from django.core.mail import send_mail


def _recipient(order) -> str:
    return (order.client_email or '').strip()


def notify_order_client(order, *, subject: str, body: str) -> dict:
    recipient = _recipient(order)
    if not recipient:
        return {'status': 'FAILED', 'error': 'Aucun email client'}
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient],
            fail_silently=False,
        )
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}


def email_order_confirmed(order) -> dict:
    biz = order.business.name if order.business_id else 'la boutique'
    return notify_order_client(
        order,
        subject=f'[Isoko Hub] Commande confirmée — {biz}',
        body=(
            f'Bonjour {order.client_display_name},\n\n'
            f'Votre commande {order.reference_code or order.id} chez {biz} '
            f'({order.total_amount} {order.currency}) a été confirmée.\n'
            f'Retrait en magasin uniquement.\n\n— Isoko Hub\n'
        ),
    )


def email_order_ready(order) -> dict:
    biz = order.business.name if order.business_id else 'la boutique'
    return notify_order_client(
        order,
        subject=f'[Isoko Hub] Commande prête au retrait — {biz}',
        body=(
            f'Bonjour {order.client_display_name},\n\n'
            f'Votre commande {order.reference_code or order.id} est prête au retrait chez {biz}.\n\n'
            f'— Isoko Hub\n'
        ),
    )


def email_order_rejected(order, reason: str = '') -> dict:
    biz = order.business.name if order.business_id else 'la boutique'
    extra = f'\nMotif : {reason}\n' if reason else '\n'
    return notify_order_client(
        order,
        subject=f'[Isoko Hub] Commande refusée — {biz}',
        body=(
            f'Bonjour {order.client_display_name},\n\n'
            f'Votre commande {order.reference_code or order.id} chez {biz} a été refusée.'
            f'{extra}\n— Isoko Hub\n'
        ),
    )
