"""Préviens l'administrateur dès qu'un article entre en stock faible ou en rupture."""
import logging

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

RANK = {'OK': 0, 'LOW': 1, 'OUT': 2}


def stock_level(quantity, threshold):
    qty = int(quantity or 0)
    limit = int(threshold or 0)
    if qty <= 0:
        return 'OUT'
    if qty <= limit:
        return 'LOW'
    return 'OK'


def _remember(instance, quantity, threshold):
    instance._stock_qty_before = quantity
    instance._stock_threshold_before = threshold


def _before(instance):
    if getattr(instance, '_state', None) is not None and instance._state.adding:
        return None, None
    return getattr(instance, '_stock_qty_before', None), getattr(instance, '_stock_threshold_before', None)


def notify_stock_change(*, business, sector, product_id, product_name, before_qty, after_qty,
                        before_threshold, after_threshold, variant_id=None):
    """Crée une alerte et envoie un e-mail seulement quand le niveau se dégrade."""
    if business is None or before_qty is None:
        previous = 'OK'
    else:
        previous = stock_level(before_qty, before_threshold if before_threshold is not None else after_threshold)
    current = stock_level(after_qty, after_threshold)
    if previous == current:
        return None

    from .models import StockAlert

    open_alerts = StockAlert.objects.filter(
        business=business,
        product_id=product_id,
        variant_id=variant_id,
        is_resolved=False,
    ).exclude(level__in=('EXPIRED', 'EXPIRING'))
    if current == 'OK':
        open_alerts.update(is_resolved=True)
        return None
    if RANK[current] < RANK[previous]:
        open_alerts.update(
            level=current,
            quantity=int(after_qty or 0),
            threshold=int(after_threshold or 0),
            product_name=product_name,
        )
        return None

    open_alerts.update(is_resolved=True)
    alert = StockAlert.objects.create(
        business=business,
        sector=sector,
        product_id=product_id,
        variant_id=variant_id,
        product_name=product_name[:255],
        level=current,
        quantity=int(after_qty or 0),
        threshold=int(after_threshold or 0),
    )
    transaction.on_commit(lambda: _email_alert(alert.id))
    return alert


def _email_alert(alert_id):
    from .models import StockAlert
    from accounts.outbound_mail import send_isoko_mail

    alert = StockAlert.objects.select_related('business', 'business__owner').filter(pk=alert_id).first()
    if not alert or alert.is_resolved:
        return
    business = alert.business
    recipients = []
    for raw in (business.email, getattr(business.owner, 'email', '')):
        value = (raw or '').strip()
        if value and value not in recipients:
            recipients.append(value)
    if not recipients:
        return
    if alert.level == 'OUT':
        subject = f'Rupture de stock — {alert.product_name}'
        detail = f'{alert.product_name} est en rupture. Stock disponible : 0.'
    elif alert.level == 'EXPIRED':
        subject = f'Lot périmé — {alert.product_name}'
        detail = f'{alert.product_name} est périmé. Retirez-le de la vente.'
    elif alert.level == 'EXPIRING':
        subject = f'Péremption proche — {alert.product_name}'
        detail = f'{alert.product_name} arrive à péremption dans les 30 jours.'
    else:
        subject = f'Stock faible — {alert.product_name}'
        detail = (
            f'{alert.product_name} est passé sous le seuil. '
            f'Il reste {alert.quantity} (seuil {alert.threshold}).'
        )
    body = (
        f'Bonjour,\n\n'
        f'{detail}\n\n'
        f'Établissement : {business.name}\n'
        f'Ouvrez le stock dans Isoko Hub pour réapprovisionner.\n'
    )
    try:
        send_isoko_mail(subject, body, recipients)
    except Exception:
        logger.exception('E-mail d’alerte stock non envoyé pour %s', alert_id)


def _apply(instance, *, business, sector, product_id, product_name, after_qty, after_threshold, variant_id=None, active=True):
    before_qty, before_threshold = _before(instance)
    if not active:
        if before_qty is not None:
            from .models import StockAlert
            StockAlert.objects.filter(
                business=business, product_id=product_id, variant_id=variant_id, is_resolved=False,
            ).update(is_resolved=True)
        return
    notify_stock_change(
        business=business,
        sector=sector,
        product_id=product_id,
        product_name=product_name,
        before_qty=before_qty,
        after_qty=after_qty,
        before_threshold=before_threshold if before_threshold is not None else after_threshold,
        after_threshold=after_threshold,
        variant_id=variant_id,
    )


def _sync_expiry(product, business, sector):
    """Alerte une fois quand un lot entre dans les 30 jours, puis quand il est périmé."""
    from datetime import timedelta

    from django.utils import timezone

    from .models import StockAlert

    if business is None:
        return False
    today = timezone.localdate()
    expiry = product.expiration_date
    if isinstance(expiry, str):
        from datetime import date
        expiry = date.fromisoformat(expiry[:10])
    if not expiry or expiry > today + timedelta(days=30) or getattr(product, 'status', 'ACTIVE') != 'ACTIVE':
        StockAlert.objects.filter(
            business=business,
            product_id=product.id,
            level__in=('EXPIRED', 'EXPIRING'),
            is_resolved=False,
        ).update(is_resolved=True)
        return False
    level = 'EXPIRED' if expiry < today else 'EXPIRING'
    current = StockAlert.objects.filter(
        business=business,
        product_id=product.id,
        level__in=('EXPIRED', 'EXPIRING'),
        is_resolved=False,
    ).first()
    if current and current.level == level:
        return False
    if current:
        current.is_resolved = True
        current.save(update_fields=['is_resolved'])
    alert = StockAlert.objects.create(
        business=business,
        sector=sector,
        product_id=product.id,
        product_name=product.name[:255],
        level=level,
        quantity=int(product.quantity_real or 0),
        threshold=0,
    )
    transaction.on_commit(lambda alert_id=alert.id: _email_alert(alert_id))
    return True


def scan_expiry_alerts():
    """Parcourt les lots pharmacie. À lancer une fois par jour (pas de file d'attente)."""
    from retail.models import RetailProduct
    from wholesale.models import WholesaleProduct

    created = 0
    retail = RetailProduct.objects.filter(expiration_date__isnull=False).select_related('retail_business')
    for product in retail:
        if _sync_expiry(product, product.retail_business, 'retail'):
            created += 1
    wholesale = WholesaleProduct.objects.filter(expiration_date__isnull=False).select_related('wholesale_business')
    for product in wholesale:
        if _sync_expiry(product, product.wholesale_business, 'wholesale'):
            created += 1
    return created


def connect_stock_alert_signals():
    from products.models import Product, ProductVariant
    from retail.models import RetailProduct
    from wholesale.models import WholesaleProduct

    @receiver(pre_save, sender=Product, dispatch_uid='stock_alert_product_pre')
    def product_pre(sender, instance, **kwargs):
        if instance._state.adding:
            _remember(instance, None, None)
            return
        row = sender.objects.filter(pk=instance.pk).values('stock', 'low_stock_threshold').first()
        if not row:
            _remember(instance, None, None)
            return
        _remember(instance, row['stock'], row['low_stock_threshold'])

    @receiver(post_save, sender=Product, dispatch_uid='stock_alert_product_post')
    def product_post(sender, instance, **kwargs):
        if instance.has_variants:
            return
        _apply(
            instance,
            business=instance.business,
            sector='commerce',
            product_id=instance.id,
            product_name=instance.name,
            after_qty=instance.stock,
            after_threshold=instance.low_stock_threshold,
            active=instance.is_active,
        )

    @receiver(pre_save, sender=ProductVariant, dispatch_uid='stock_alert_variant_pre')
    def variant_pre(sender, instance, **kwargs):
        if instance._state.adding:
            _remember(instance, None, None)
            return
        row = sender.objects.filter(pk=instance.pk).values('stock').first()
        product = instance.product
        _remember(instance, None if not row else row['stock'], product.low_stock_threshold)

    @receiver(post_save, sender=ProductVariant, dispatch_uid='stock_alert_variant_post')
    def variant_post(sender, instance, **kwargs):
        product = instance.product
        label = instance.label
        name = product.name if label == 'Standard' else f'{product.name} — {label}'
        _apply(
            instance,
            business=product.business,
            sector='commerce',
            product_id=product.id,
            variant_id=instance.id,
            product_name=name,
            after_qty=instance.stock,
            after_threshold=product.low_stock_threshold,
            active=instance.is_active and product.is_active,
        )

    @receiver(pre_save, sender=RetailProduct, dispatch_uid='stock_alert_retail_pre')
    def retail_pre(sender, instance, **kwargs):
        if instance._state.adding:
            _remember(instance, None, None)
            return
        row = sender.objects.filter(pk=instance.pk).values(
            'quantity_real', 'quantity_reserved', 'low_stock_threshold',
        ).first()
        if not row:
            _remember(instance, None, None)
            return
        available = max(0, int(row['quantity_real']) - int(row['quantity_reserved']))
        _remember(instance, available, row['low_stock_threshold'])

    @receiver(post_save, sender=RetailProduct, dispatch_uid='stock_alert_retail_post')
    def retail_post(sender, instance, **kwargs):
        _apply(
            instance,
            business=instance.retail_business,
            sector='retail',
            product_id=instance.id,
            product_name=instance.name,
            after_qty=instance.quantity_available,
            after_threshold=instance.low_stock_threshold,
            active=instance.status == 'ACTIVE',
        )
        _sync_expiry(instance, instance.retail_business, 'retail')

    @receiver(pre_save, sender=WholesaleProduct, dispatch_uid='stock_alert_wholesale_pre')
    def wholesale_pre(sender, instance, **kwargs):
        if instance._state.adding:
            _remember(instance, None, None)
            return
        row = sender.objects.filter(pk=instance.pk).values(
            'quantity_real', 'quantity_reserved', 'low_stock_threshold',
        ).first()
        if not row:
            _remember(instance, None, None)
            return
        available = max(0, int(row['quantity_real']) - int(row['quantity_reserved']))
        _remember(instance, available, row['low_stock_threshold'])

    @receiver(post_save, sender=WholesaleProduct, dispatch_uid='stock_alert_wholesale_post')
    def wholesale_post(sender, instance, **kwargs):
        _apply(
            instance,
            business=instance.wholesale_business,
            sector='wholesale',
            product_id=instance.id,
            product_name=instance.name,
            after_qty=instance.quantity_available,
            after_threshold=instance.low_stock_threshold,
            active=instance.status == 'ACTIVE',
        )
        _sync_expiry(instance, instance.wholesale_business, 'wholesale')
