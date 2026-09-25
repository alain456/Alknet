
from decimal import Decimal
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import (
    WholesaleOrder, WholesaleOrderItem, WholesaleOrderEvent,
    WholesaleProduct, StockMovement, NotificationLog, WholesalePharmacyProfile,
    ProformaInvoice,
)


REFUSAL_REASONS = [
    'Stock insuffisant',
    'Produit indisponible',
    'Quantite non conforme au conditionnement',
    'Prix a verifier',
    'Informations de la pharmacie cliente incompletes',
    'Commande non conforme',
    'Autre',
]


def generate_proforma_reference(wholesale_business):
    year = timezone.now().year
    count = ProformaInvoice.objects.filter(
        wholesale_business=wholesale_business,
        created_at__year=year,
    ).count() + 1
    return f'PF-PG-{year}-{count:06d}'


def build_cart_lines_snapshot(cart):
    lines = []
    for item in cart.items.select_related('product').all():
        p = item.product
        unit = item.unit_price_snapshot or p.wholesale_price
        qty = item.quantity
        lines.append({
            'product_id': str(p.id),
            'product_name': item.product_name_snapshot or p.name,
            'active_ingredient': p.active_ingredient,
            'packaging': item.packaging_snapshot or p.packaging,
            'wholesale_unit': item.wholesale_unit_snapshot or p.wholesale_unit,
            'unit_price': str(unit),
            'quantity': qty,
            'line_total': str(unit * qty),
            'currency': p.currency or 'BIF',
            'stock_status': p.stock_status,
            'is_active': p.status == 'ACTIVE',
            'quantity_available': p.quantity_available,
            'min_order_quantity': p.min_order_quantity,
        })
    return lines


def sync_draft_proforma(cart):
    """Regénère la facture proforma brouillon liée au panier."""
    lines = build_cart_lines_snapshot(cart)
    total = sum((Decimal(l['line_total']) for l in lines), Decimal('0'))
    proforma = (
        ProformaInvoice.objects.filter(cart=cart, status='DRAFT')
        .order_by('-generated_at')
        .first()
    )
    if not lines:
        if proforma:
            proforma.status = 'CANCELLED'
            proforma.subtotal = Decimal('0')
            proforma.total = Decimal('0')
            proforma.lines_snapshot = []
            proforma.save(update_fields=[
                'status', 'subtotal', 'total', 'lines_snapshot', 'updated_at'
            ])
        return None

    if not proforma:
        proforma = ProformaInvoice.objects.create(
            cart=cart,
            client_business=cart.client_business,
            wholesale_business=cart.wholesale_business,
            status='DRAFT',
            reference=generate_proforma_reference(cart.wholesale_business),
            subtotal=total,
            total=total,
            currency='BIF',
            lines_snapshot=lines,
            generated_at=timezone.now(),
        )
    else:
        proforma.subtotal = total
        proforma.total = total
        proforma.lines_snapshot = lines
        proforma.generated_at = timezone.now()
        proforma.save(update_fields=[
            'subtotal', 'total', 'lines_snapshot', 'generated_at', 'updated_at'
        ])
    return proforma


def snapshot_cart_item(item, product=None):
    product = product or item.product
    item.product_name_snapshot = product.name
    item.packaging_snapshot = product.packaging
    item.wholesale_unit_snapshot = product.wholesale_unit
    item.unit_price_snapshot = product.wholesale_price
    return item


def ensure_wholesale_profile(business):
    profile, _ = WholesalePharmacyProfile.objects.get_or_create(business=business)
    return profile


def generate_order_reference(wholesale_business):
    profile = ensure_wholesale_profile(wholesale_business)
    year = timezone.now().year
    prefix = (profile.order_reference_prefix or 'CMD-PG').upper()
    count = WholesaleOrder.objects.filter(
        wholesale_business=wholesale_business,
        created_at__year=year,
    ).exclude(status='DRAFT').count() + 1
    return f'{prefix}-{year}-{count:06d}'


def log_order_event(order, event_type, message='', user=None):
    return WholesaleOrderEvent.objects.create(
        order=order, event_type=event_type, message=message or '', user=user
    )


def recalculate_order_total(order):
    total = sum((item.line_total for item in order.items.all()), Decimal('0'))
    order.total_amount = total
    order.save(update_fields=['total_amount', 'updated_at'])
    return total


def adjust_stock(product, new_real_qty, reason, user=None, order=None):
    old = product.quantity_real
    new = max(0, int(new_real_qty))
    diff = new - old
    product.quantity_real = new
    product.save(update_fields=['quantity_real', 'updated_at'])
    StockMovement.objects.create(
        product=product,
        old_quantity=old,
        new_quantity=new,
        difference=diff,
        reason=reason,
        user=user,
        order=order,
    )
    return product


@transaction.atomic
def accept_order(order, user):
    if order.status not in ('SUBMITTED', 'PROCESSING'):
        raise ValueError('Seules les commandes envoyees peuvent etre acceptees.')
    if order.payment_status != 'PAID':
        raise ValueError(
            'L\'acheteur doit d\'abord payer via BurundiPay avant que la commande puisse être acceptée.'
        )

    for item in order.items.select_related('product'):
        product = item.product
        if not product or product.status != 'ACTIVE':
            raise ValueError(f'Produit indisponible: {item.product_name_snapshot}')
        if product.quantity_available < item.quantity:
            raise ValueError(
                f'Stock insuffisant pour {product.name} '
                f'(disponible: {product.quantity_available}, demande: {item.quantity})'
            )

    for item in order.items.select_related('product'):
        product = item.product
        old_reserved = product.quantity_reserved
        product.quantity_reserved = old_reserved + item.quantity
        product.save(update_fields=['quantity_reserved', 'updated_at'])
        StockMovement.objects.create(
            product=product,
            old_quantity=product.quantity_real,
            new_quantity=product.quantity_real,
            difference=0,
            reason=f'Reservation commande {order.reference} (+{item.quantity} reserve)',
            user=user,
            order=order,
        )

    order.status = 'ACCEPTED'
    order.accepted_by = user
    order.accepted_at = timezone.now()
    order.save(update_fields=['status', 'accepted_by', 'accepted_at', 'updated_at'])
    log_order_event(order, 'ACCEPTED', 'Commande acceptee — stock reserve.', user)

    proforma = ProformaInvoice.objects.filter(order=order).first()
    if proforma:
        proforma.status = 'CONFIRMED'
        proforma.confirmed_at = timezone.now()
        proforma.save(update_fields=['status', 'confirmed_at', 'updated_at'])

    email_result = notify_order_accepted(order)
    return order, email_result


@transaction.atomic
def mark_order_paid(order, user, payment_method='', payment_note=''):
    """Fallback caisse : marque payée (espèces / autre). Flux normal = BurundiPay client."""
    if order.status not in ('SUBMITTED', 'PROCESSING', 'ACCEPTED'):
        raise ValueError('Cette commande ne peut pas être marquée payée.')
    if order.payment_status == 'PAID':
        raise ValueError('Cette commande est déjà marquée payée.')
    method = (payment_method or '').strip().upper()[:40] or 'CASH'
    order.payment_status = 'PAID'
    order.payment_method = method
    order.payment_note = (payment_note or '').strip() or f'Marqué payé par le personnel ({method})'
    order.paid_at = timezone.now()
    order.paid_by = user
    order.save(update_fields=[
        'payment_status', 'payment_method', 'payment_note',
        'paid_at', 'paid_by', 'updated_at',
    ])
    log_order_event(
        order,
        'PAYMENT_RECORDED',
        f'Paiement confirmé par le personnel ({method}).',
        user,
    )
    return order


@transaction.atomic
def mark_order_unpaid(order, user):
    """Annule le marquage payé (correction vendeur)."""
    if order.payment_status != 'PAID':
        raise ValueError('Cette commande n\'est pas marquée payée.')
    order.payment_status = 'UNPAID'
    order.payment_method = ''
    order.payment_note = ''
    order.paid_at = None
    order.paid_by = None
    order.save(update_fields=[
        'payment_status', 'payment_method', 'payment_note',
        'paid_at', 'paid_by', 'updated_at',
    ])
    log_order_event(order, 'PAYMENT_CLEARED', 'Marquage payé annulé par le vendeur.', user)
    return order


@transaction.atomic
def reject_order(order, user, reason, comment=''):
    if order.status not in ('SUBMITTED', 'PROCESSING'):
        raise ValueError('Seules les commandes envoyees peuvent etre refusees.')
    if not reason:
        raise ValueError('Le motif de refus est obligatoire.')
    order.status = 'REJECTED'
    order.refusal_reason = reason
    order.refusal_comment = comment or ''
    order.refused_by = user
    order.refused_at = timezone.now()
    order.save(update_fields=[
        'status', 'refusal_reason', 'refusal_comment', 'refused_by', 'refused_at', 'updated_at'
    ])
    log_order_event(order, 'REJECTED', f'Refus: {reason}. {comment}'.strip(), user)

    proforma = ProformaInvoice.objects.filter(order=order).first()
    if proforma:
        proforma.status = 'REJECTED'
        proforma.save(update_fields=['status', 'updated_at'])

    # Libérer toute réservation éventuelle (si acceptation partielle / état incohérent)
    for item in order.items.select_related('product'):
        product = item.product
        if not product:
            continue
        if product.quantity_reserved >= item.quantity:
            product.quantity_reserved = product.quantity_reserved - item.quantity
            product.save(update_fields=['quantity_reserved', 'updated_at'])
            StockMovement.objects.create(
                product=product,
                old_quantity=product.quantity_real,
                new_quantity=product.quantity_real,
                difference=0,
                reason=f'Liberation reservation {order.reference} (-{item.quantity})',
                user=user,
                order=order,
            )
    email_result = notify_order_rejected(order, reason=reason, comment=comment)
    return order, email_result


def _wholesale_client_email(order):
    return (
        order.notification_email
        or (order.client_business.email if order.client_business_id else '')
        or order.buyer_email
        or (order.created_by.email if order.created_by_id else '')
        or ''
    ).strip()


def notify_order_rejected(order, reason='', comment=''):
    client_name = (
        order.client_business.name if order.client_business_id else (order.buyer_name or 'Client')
    )
    recipient = _wholesale_client_email(order)
    log = NotificationLog.objects.create(
        order=order,
        recipient_business=order.client_business,
        recipient_email=recipient or 'unknown@example.com',
        notification_type='ORDER_REJECTED',
        status='PENDING',
    )
    if not recipient:
        log.status = 'FAILED'
        log.error_message = 'Aucun email destinataire.'
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'error': log.error_message, 'label': "Echec de l'envoi"}

    body = (
        f'Bonjour,\n\n'
        f'La pharmacie de gros {order.wholesale_business.name} a refuse votre commande.\n\n'
        f'Reference : {order.reference}\n'
        f'Pharmacie cliente : {client_name}\n'
        f'Motif : {reason or "Non precise"}\n'
        + (f'Detail : {comment}\n' if comment else '')
        + '\nVeuillez consulter votre espace professionnel pour plus de details.\n'
        f'\n— Isoko Hub\n'
    )
    try:
        send_mail(
            subject=f'[Isoko Hub] Commande {order.reference} refusee',
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient],
            fail_silently=False,
        )
        log.status = 'SENT'
        log.sent_at = timezone.now()
        log.save(update_fields=['status', 'sent_at'])
        return {'status': 'SENT', 'recipient': recipient, 'label': 'Email envoye'}
    except Exception as exc:
        log.status = 'FAILED'
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])
        return {
            'status': 'FAILED',
            'error': str(exc),
            'recipient': recipient,
            'label': "Echec de l'envoi",
        }


def notify_order_accepted(order):
    client_name = (
        order.client_business.name if order.client_business_id else (order.buyer_name or 'Client')
    )
    recipient = (
        order.notification_email
        or (order.client_business.email if order.client_business_id else '')
        or order.buyer_email
        or (order.created_by.email if order.created_by_id else '')
    )
    log = NotificationLog.objects.create(
        order=order,
        recipient_business=order.client_business,
        recipient_email=recipient or 'unknown@example.com',
        notification_type='ORDER_ACCEPTED',
        status='PENDING',
    )
    if not recipient:
        log.status = 'FAILED'
        log.error_message = 'Aucun email destinataire.'
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'error': log.error_message, 'label': 'Echec de l\'envoi'}

    items_txt = '\n'.join(
        f'- {i.product_name_snapshot} — {i.quantity} — {i.packaging_snapshot}'
        for i in order.items.all()
    )
    accept_date = timezone.now().strftime('%d/%m/%Y %H:%M')
    body = (
        f'Bonjour,\n\n'
        f'La pharmacie de gros {order.wholesale_business.name} confirme l\'acceptation de votre commande.\n\n'
        f'Reference : {order.reference}\n'
        f'Pharmacie cliente : {client_name}\n'
        f'Date d\'acceptation : {accept_date}\n'
        f'Montant total : {order.total_amount} {order.currency}\n'
        f'Statut : Acceptee\n\n'
        f'Detail des produits :\n{items_txt}\n\n'
        f'Veuillez consulter votre espace professionnel pour voir le detail de la commande.\n'
    )
    try:
        send_mail(
            subject=f'Commande {order.reference} acceptee',
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient],
            fail_silently=False,
        )
        log.status = 'SENT'
        log.sent_at = timezone.now()
        log.save(update_fields=['status', 'sent_at'])
        return {'status': 'SENT', 'recipient': recipient, 'label': 'Email envoye'}
    except Exception as exc:
        log.status = 'FAILED'
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])
        return {
            'status': 'FAILED',
            'error': str(exc),
            'recipient': recipient,
            'label': 'Echec de l\'envoi',
        }
