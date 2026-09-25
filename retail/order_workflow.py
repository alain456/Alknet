from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import (
    NotificationLog,
    ProformaInvoice,
    RetailCart,
    RetailOrder,
    RetailOrderEvent,
    RetailOrderItem,
    RetailPharmacyProfile,
    RetailProduct,
    StockMovement,
)


REJECTION_REASONS = [
    'Stock insuffisant',
    'Produit indisponible',
    'Ordonnance manquante ou non conforme',
    'Informations patient incompletes',
    'Commande non conforme',
    'Autre',
]


def ensure_retail_profile(business):
    profile, _ = RetailPharmacyProfile.objects.get_or_create(business=business)
    return profile


def generate_order_reference(retail_business):
    profile = ensure_retail_profile(retail_business)
    year = timezone.now().year
    count = RetailOrder.objects.filter(
        retail_business=retail_business, created_at__year=year
    ).exclude(status='DRAFT').count() + 1
    prefix = (profile.order_reference_prefix or 'CMD-PD').upper()
    return f'{prefix}-{year}-{count:06d}'


def generate_proforma_reference(retail_business):
    year = timezone.now().year
    count = ProformaInvoice.objects.filter(
        retail_business=retail_business, created_at__year=year
    ).count() + 1
    return f'PF-PD-{year}-{count:06d}'


def log_order_event(order, event_type, message='', user=None):
    return RetailOrderEvent.objects.create(
        order=order, event_type=event_type, message=message or '', user=user
    )


def recalculate_order_total(order):
    order.total_amount = sum(
        (item.line_total for item in order.items.all()), Decimal('0')
    )
    order.save(update_fields=['total_amount', 'updated_at'])
    return order.total_amount


def snapshot_cart_item(item, product=None):
    product = product or item.product
    item.product_name_snapshot = product.name
    item.packaging_snapshot = product.packaging
    item.sales_unit_snapshot = product.sales_unit
    item.unit_price_snapshot = product.retail_price
    return item


def build_cart_lines_snapshot(cart):
    return [
        {
            'product_id': str(item.product_id),
            'product_name': item.product_name_snapshot or item.product.name,
            'packaging': item.packaging_snapshot or item.product.packaging,
            'sales_unit': item.sales_unit_snapshot or item.product.sales_unit,
            'unit_price': str(item.unit_price_snapshot or item.product.retail_price),
            'quantity': item.quantity,
            'line_total': str(
                (item.unit_price_snapshot or item.product.retail_price) * item.quantity
            ),
            'currency': item.product.currency,
            'prescription_required': item.product.prescription_required,
        }
        for item in cart.items.select_related('product')
    ]


def sync_draft_proforma(cart, patient_name='', patient_email=''):
    lines = build_cart_lines_snapshot(cart)
    proforma = ProformaInvoice.objects.filter(
        cart=cart, status='DRAFT'
    ).order_by('-generated_at').first()
    if not lines:
        if proforma:
            proforma.status = 'CANCELLED'
            proforma.save(update_fields=['status', 'updated_at'])
        return None

    total = sum((Decimal(line['line_total']) for line in lines), Decimal('0'))
    name = patient_name or cart.patient.get_full_name()
    email = patient_email or cart.patient.email
    if not proforma:
        proforma = ProformaInvoice.objects.create(
            reference=generate_proforma_reference(cart.retail_business),
            cart=cart,
            patient=cart.patient,
            patient_name=name,
            patient_email=email,
            retail_business=cart.retail_business,
            subtotal=total,
            total=total,
            lines_snapshot=lines,
        )
    else:
        proforma.patient_name = name
        proforma.patient_email = email
        proforma.subtotal = total
        proforma.total = total
        proforma.lines_snapshot = lines
        proforma.generated_at = timezone.now()
        proforma.save(update_fields=[
            'patient_name', 'patient_email', 'subtotal', 'total',
            'lines_snapshot', 'generated_at', 'updated_at',
        ])
    return proforma


def adjust_stock(product, new_real_qty, reason, user=None, order=None):
    old = product.quantity_real
    new = max(0, int(new_real_qty))
    product.quantity_real = new
    product.save(update_fields=['quantity_real', 'updated_at'])
    StockMovement.objects.create(
        product=product,
        old_quantity=old,
        new_quantity=new,
        difference=new - old,
        reason=reason,
        user=user,
        order=order,
    )
    return product


def validate_order_items(order):
    if not order.items.exists():
        raise ValueError('Commande vide.')
    for item in order.items.select_related('product'):
        product = item.product
        if not product or product.status != 'ACTIVE':
            raise ValueError(f'Produit indisponible: {item.product_name_snapshot}')
        if item.quantity > product.quantity_available:
            raise ValueError(f'Stock insuffisant pour {product.name}.')


@transaction.atomic
def submit_order(order, user=None):
    if order.status != 'DRAFT':
        raise ValueError('Seuls les brouillons peuvent etre envoyes.')
    validate_order_items(order)
    order.reference = generate_order_reference(order.retail_business)
    order.status = 'SUBMITTED'
    order.submitted_at = timezone.now()
    recalculate_order_total(order)
    order.save(update_fields=['reference', 'status', 'submitted_at', 'updated_at'])
    log_order_event(order, 'SUBMITTED', 'Commande envoyee par le patient.', user)
    return order


@transaction.atomic
def accept_order(order, user):
    if order.status not in ('SUBMITTED', 'PROCESSING', 'CLARIFICATION_REQUESTED'):
        raise ValueError('Cette commande ne peut pas etre acceptee.')
    if order.payment_status != 'PAID':
        raise ValueError(
            'Le client doit d\'abord payer via BurundiPay avant que la commande puisse être acceptée.'
        )

    locked = {}
    for item in order.items.select_related('product'):
        if not item.product_id:
            raise ValueError(f'Produit indisponible: {item.product_name_snapshot}')
        product = RetailProduct.objects.select_for_update().get(pk=item.product_id)
        if product.status != 'ACTIVE' or product.quantity_available < item.quantity:
            raise ValueError(f'Stock insuffisant ou produit indisponible: {product.name}')
        locked[item.product_id] = product

    for item in order.items.all():
        product = locked[item.product_id]
        product.quantity_reserved += item.quantity
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
    log_order_event(order, 'ACCEPTED', 'Commande acceptee - stock reserve.', user)

    proforma = ProformaInvoice.objects.filter(order=order).first()
    if proforma:
        proforma.status = 'CONFIRMED'
        proforma.confirmed_at = timezone.now()
        proforma.save(update_fields=['status', 'confirmed_at', 'updated_at'])
    return order, notify_order_accepted(order)


@transaction.atomic
def mark_order_paid(order, user, payment_method='', payment_note=''):
    """
    Fallback caisse : marque payée (espèces / autre) si besoin.
    Le flux normal = paiement BurundiPay client avant acceptation.
    """
    if order.status not in ('SUBMITTED', 'PROCESSING', 'CLARIFICATION_REQUESTED', 'ACCEPTED'):
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
    if order.status not in ('SUBMITTED', 'PROCESSING', 'CLARIFICATION_REQUESTED'):
        raise ValueError('Cette commande ne peut pas etre refusee.')
    if not reason:
        raise ValueError('Le motif de refus est obligatoire.')
    order.status = 'REJECTED'
    order.rejection_reason = reason
    order.rejection_comment = comment or ''
    order.rejected_by = user
    order.rejected_at = timezone.now()
    order.save(update_fields=[
        'status', 'rejection_reason', 'rejection_comment',
        'rejected_by', 'rejected_at', 'updated_at',
    ])
    ProformaInvoice.objects.filter(order=order).update(status='REJECTED')
    log_order_event(order, 'REJECTED', f'Refus: {reason}. {comment}'.strip(), user)
    email_result = notify_order_rejected(order, reason=reason, comment=comment)
    return order, email_result


@transaction.atomic
def request_clarification(order, user, comment):
    if order.status not in ('SUBMITTED', 'PROCESSING'):
        raise ValueError('Une clarification ne peut pas etre demandee dans cet etat.')
    if not comment:
        raise ValueError('Le commentaire de clarification est obligatoire.')
    order.status = 'CLARIFICATION_REQUESTED'
    order.clarification_comment = comment
    order.save(update_fields=['status', 'clarification_comment', 'updated_at'])
    log_order_event(order, 'CLARIFICATION_REQUESTED', comment, user)
    email_result = notify_clarification_requested(order, comment=comment)
    return order, email_result


def create_order_from_items(
    retail_business, rows, patient_name, patient_email, patient_phone='',
    patient=None, user=None, is_guest=False, payer_phone='', payment_method='',
):
    order = RetailOrder.objects.create(
        retail_business=retail_business,
        patient=patient,
        patient_name=patient_name,
        patient_email=patient_email,
        patient_phone=patient_phone,
        notification_email=patient_email,
        is_guest=is_guest,
        created_by=user,
        payer_phone=(payer_phone or '').strip()[:40],
        payment_method=(payment_method or '').strip().upper()[:40],
    )
    try:
        for row in rows:
            product = RetailProduct.objects.get(
                id=row.get('product_id'),
                retail_business=retail_business,
                status='ACTIVE',
            )
            quantity = int(row.get('quantity') or 1)
            if quantity < 1 or quantity > product.quantity_available:
                raise ValueError(f'Quantite invalide ou stock insuffisant pour {product.name}.')
            RetailOrderItem.objects.create(
                order=order,
                product=product,
                product_name_snapshot=product.name,
                packaging_snapshot=product.packaging,
                sales_unit_snapshot=product.sales_unit,
                unit_price_snapshot=product.retail_price,
                prescription_required_snapshot=product.prescription_required,
                quantity=quantity,
                line_total=product.retail_price * quantity,
            )
        submit_order(order, user)
    except Exception:
        order.delete()
        raise
    return order


def create_order_proforma(order, cart=None):
    lines = [
        {
            'product_id': str(item.product_id) if item.product_id else None,
            'product_name': item.product_name_snapshot,
            'packaging': item.packaging_snapshot,
            'sales_unit': item.sales_unit_snapshot,
            'unit_price': str(item.unit_price_snapshot),
            'quantity': item.quantity,
            'line_total': str(item.line_total),
            'prescription_required': item.prescription_required_snapshot,
        }
        for item in order.items.all()
    ]
    return ProformaInvoice.objects.create(
        reference=generate_proforma_reference(order.retail_business),
        cart=cart,
        order=order,
        patient=order.patient,
        patient_name=order.patient_name,
        patient_email=order.patient_email,
        retail_business=order.retail_business,
        status='PENDING_VALIDATION',
        subtotal=order.total_amount,
        total=order.total_amount,
        currency=order.currency,
        lines_snapshot=lines,
    )


def notify_order_accepted(order):
    recipient = order.notification_email or order.patient_email
    log = NotificationLog.objects.create(
        order=order,
        recipient_email=recipient or 'unknown@example.com',
        status='PENDING',
    )
    if not recipient:
        log.status = 'FAILED'
        log.error_message = 'Aucun email destinataire.'
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'error': log.error_message}

    profile = ensure_retail_profile(order.retail_business)
    context = {
        'patient_name': order.patient_name,
        'reference': order.reference,
        'pharmacy_name': profile.commercial_name or order.retail_business.name,
        'total_amount': order.total_amount,
        'currency': order.currency,
    }
    try:
        body = profile.acceptance_email_message.format(**context)
    except (KeyError, ValueError):
        body = (
            f'Bonjour {order.patient_name},\n\nVotre commande {order.reference} '
            f'a ete acceptee par {order.retail_business.name}.'
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
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        log.status = 'FAILED'
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}


def _retail_client_email(order):
    return (order.notification_email or order.patient_email or '').strip()


def notify_order_rejected(order, reason='', comment=''):
    recipient = _retail_client_email(order)
    log = NotificationLog.objects.create(
        order=order,
        recipient_email=recipient or 'unknown@example.com',
        status='PENDING',
    )
    if not recipient:
        log.status = 'FAILED'
        log.error_message = 'Aucun email destinataire.'
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'error': log.error_message}

    pharmacy = order.retail_business.name
    body = (
        f'Bonjour {order.patient_name or "Client"},\n\n'
        f'Votre commande {order.reference} a été refusée par {pharmacy}.\n\n'
        f'Motif : {reason or "Non précisé"}\n'
        + (f'Détail : {comment}\n' if comment else '')
        + '\nPour toute question, contactez la pharmacie.\n'
        f'\n— Isoko Hub\n'
    )
    try:
        send_mail(
            subject=f'[Isoko Hub] Commande {order.reference} refusée',
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient],
            fail_silently=False,
        )
        log.status = 'SENT'
        log.sent_at = timezone.now()
        log.save(update_fields=['status', 'sent_at'])
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        log.status = 'FAILED'
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}


def notify_clarification_requested(order, comment=''):
    recipient = _retail_client_email(order)
    log = NotificationLog.objects.create(
        order=order,
        recipient_email=recipient or 'unknown@example.com',
        status='PENDING',
    )
    if not recipient:
        log.status = 'FAILED'
        log.error_message = 'Aucun email destinataire.'
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'error': log.error_message}

    pharmacy = order.retail_business.name
    body = (
        f'Bonjour {order.patient_name or "Client"},\n\n'
        f'La pharmacie {pharmacy} demande des précisions sur votre commande {order.reference}.\n\n'
        f'Message : {comment or "Veuillez compléter votre dossier."}\n\n'
        f'Connectez-vous à Isoko Hub pour répondre.\n'
        f'\n— Isoko Hub\n'
    )
    try:
        send_mail(
            subject=f'[Isoko Hub] Précisions demandées — commande {order.reference}',
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient],
            fail_silently=False,
        )
        log.status = 'SENT'
        log.sent_at = timezone.now()
        log.save(update_fields=['status', 'sent_at'])
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        log.status = 'FAILED'
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}


def notify_prescription_reviewed(prescription):
    """Email patient après revue d'ordonnance (ACCEPTED / REJECTED)."""
    recipient = (prescription.patient_email or '').strip()
    if not recipient:
        return {'status': 'FAILED', 'error': 'Aucun email patient'}
    status = (prescription.status or '').upper()
    if status not in ('ACCEPTED', 'REJECTED'):
        return {'status': 'SKIPPED'}
    pharmacy = getattr(prescription.retail_business, 'name', 'la pharmacie')
    if status == 'ACCEPTED':
        subject = f'[Isoko Hub] Ordonnance acceptée — {pharmacy}'
        body = (
            f'Bonjour {prescription.patient_name or "Client"},\n\n'
            f'Votre ordonnance a été acceptée par {pharmacy}.\n'
            + (f'Commentaire : {prescription.review_comment}\n' if prescription.review_comment else '')
            + '\n— Isoko Hub\n'
        )
    else:
        subject = f'[Isoko Hub] Ordonnance refusée — {pharmacy}'
        body = (
            f'Bonjour {prescription.patient_name or "Client"},\n\n'
            f'Votre ordonnance a été refusée par {pharmacy}.\n'
            + (f'Motif : {prescription.review_comment}\n' if prescription.review_comment else '')
            + '\nPour toute question, contactez la pharmacie.\n\n— Isoko Hub\n'
        )
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
