"""Emails workflow commandes Commerce — textes définis dans Paramètres."""
from __future__ import annotations

from django.conf import settings
from django.core.mail import send_mail

from businesses.commerce import ensure_commerce_profile


def _recipient(order) -> str:
    return (order.client_email or '').strip()


def _render(template: str, context: dict, fallback: str) -> str:
    text = (template or '').strip() or fallback
    try:
        return text.format(**context)
    except (KeyError, ValueError, IndexError):
        return fallback


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


def _context(order) -> dict:
    profile = ensure_commerce_profile(order.business) if order.business_id else None
    shop = ''
    if profile and (profile.commercial_name or '').strip():
        shop = profile.commercial_name.strip()
    elif order.business_id:
        shop = order.business.name
    return {
        'client_name': order.client_display_name or 'Client',
        'reference': order.reference_code or str(order.id),
        'shop_name': shop or 'la boutique',
        'total_amount': order.total_amount,
        'currency': order.currency,
    }


def _send_template(order, *, kind: str, subject: str) -> dict:
    profile = ensure_commerce_profile(order.business) if order.business_id else None
    ctx = _context(order)
    field = {
        'received': 'order_received_message',
        'accepted': 'order_accepted_message',
        'refused': 'order_refused_message',
    }[kind]
    template = getattr(profile, field, '') if profile else ''
    fallbacks = {
        'received': (
            f'Bonjour {ctx["client_name"]},\n\n'
            f'Votre commande {ctx["reference"]} a bien été enregistrée chez {ctx["shop_name"]}.'
        ),
        'accepted': (
            f'Bonjour {ctx["client_name"]},\n\n'
            f'Votre commande {ctx["reference"]} a été acceptée par {ctx["shop_name"]}.'
        ),
        'refused': (
            f'Bonjour {ctx["client_name"]},\n\n'
            f'Votre commande {ctx["reference"]} a été refusée par {ctx["shop_name"]}.'
        ),
    }
    return notify_order_client(
        order,
        subject=subject,
        body=_render(template, ctx, fallbacks[kind]),
    )


def email_order_received(order) -> dict:
    shop = _context(order)['shop_name']
    ref = order.reference_code or order.id
    return _send_template(
        order,
        kind='received',
        subject=f'[Isoko Hub] Commande {ref} enregistrée — {shop}',
    )


def email_order_confirmed(order) -> dict:
    shop = _context(order)['shop_name']
    ref = order.reference_code or order.id
    return _send_template(
        order,
        kind='accepted',
        subject=f'[Isoko Hub] Commande {ref} acceptée — {shop}',
    )


def email_order_ready(order) -> dict:
    shop = _context(order)['shop_name']
    ref = order.reference_code or order.id
    return notify_order_client(
        order,
        subject=f'[Isoko Hub] Commande prête au retrait — {shop}',
        body=(
            f'Bonjour {order.client_display_name},\n\n'
            f'Votre commande {ref} est prête au retrait chez {shop}.\n\n'
            f'— Isoko Hub\n'
        ),
    )


def email_order_rejected(order, reason: str = '') -> dict:
    shop = _context(order)['shop_name']
    ref = order.reference_code or order.id
    return _send_template(
        order,
        kind='refused',
        subject=f'[Isoko Hub] Commande {ref} refusée — {shop}',
    )


def require_client_email(result: dict) -> dict:
    """Accepter ou refuser sans e-mail délivré est interdit."""
    if not result or result.get('status') != 'SENT':
        detail = (result or {}).get('error') or 'envoi impossible'
        raise ValueError(
            'Action impossible : le client doit recevoir l’e-mail. ' + str(detail)
        )
    return result
