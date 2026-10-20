"""Séance d'inventaire pour le commerce et les pharmacies.

Le stock théorique est figé à l'ouverture. À la validation, l'écart est
recalculé sur le stock du moment, puis chaque article compté est aligné
par un mouvement « Inventaire ».
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import InventoryLine, InventorySession


def stock_sector(business):
    category = getattr(business, 'primary_category', None)
    module = (getattr(category, 'module', '') or '').strip()
    if not module and category is not None and getattr(category, 'parent_id', None):
        module = (getattr(category.parent, 'module', '') or '').strip()
    if module == 'commerce':
        return 'commerce'
    if module == 'retail_pharmacy':
        return 'retail'
    if module == 'wholesale':
        return 'wholesale'
    return ''


@transaction.atomic
@transaction.atomic
def open_session(business, user):
    sector = stock_sector(business)
    if not sector:
        raise ValidationError({'detail': 'L’inventaire est réservé au commerce et aux pharmacies.'})
    if InventorySession.objects.filter(business=business, status='OPEN').exists():
        raise ValidationError({'detail': 'Un inventaire est déjà en cours.'})
    specs = _line_specs(business, sector)
    if not specs:
        raise ValidationError({'detail': 'Aucun article à inventorier.'})
    session = InventorySession.objects.create(
        business=business,
        sector=sector,
        opened_by=user if getattr(user, 'is_authenticated', False) else None,
    )
    InventoryLine.objects.bulk_create([
        InventoryLine(session=session, **spec) for spec in specs
    ])
    return session


def _line_specs(business, sector):
    if sector == 'commerce':
        return _commerce_specs(business)
    if sector == 'retail':
        return _pharmacy_specs(business.retail_products.all())
    return _pharmacy_specs(business.wholesale_products.all())


def _commerce_specs(business):
    from products.models import Product

    specs = []
    products = Product.objects.filter(business=business).prefetch_related('variant_rows')
    for product in products:
        variants = [row for row in product.variant_rows.all() if row.is_active]
        if variants:
            for variant in variants:
                label = variant.label
                name = product.name if label == 'Standard' else f'{product.name} — {label}'
                specs.append({
                    'product_id': product.id,
                    'variant_id': variant.id,
                    'product_name': name[:255],
                    'sku': (variant.sku or product.sku or '')[:80],
                    'batch_number': '',
                    'expiration_date': None,
                    'theoretical_qty': max(0, int(variant.stock or 0)),
                })
        else:
            specs.append({
                'product_id': product.id,
                'variant_id': None,
                'product_name': product.name[:255],
                'sku': (product.sku or '')[:80],
                'batch_number': '',
                'expiration_date': None,
                'theoretical_qty': max(0, int(product.stock or 0)),
            })
    return specs


def _pharmacy_specs(queryset):
    specs = []
    for product in queryset.exclude(status='ARCHIVED'):
        specs.append({
            'product_id': product.id,
            'variant_id': None,
            'product_name': product.name[:255],
            'sku': '',
            'batch_number': (product.batch_number or '')[:120],
            'expiration_date': product.expiration_date,
            'theoretical_qty': max(0, int(product.quantity_real or 0)),
        })
    return specs


def current_quantity(line):
    """Stock physique actuel. None si l'article a disparu."""
    sector = line.session.sector
    if sector == 'commerce':
        from products.models import Product, ProductVariant
        if line.variant_id:
            stock = ProductVariant.objects.filter(pk=line.variant_id).values_list('stock', flat=True).first()
            return None if stock is None else max(0, int(stock))
        stock = Product.objects.filter(pk=line.product_id).values_list('stock', flat=True).first()
        return None if stock is None else max(0, int(stock))
    if sector == 'retail':
        from retail.models import RetailProduct
        stock = RetailProduct.objects.filter(pk=line.product_id).values_list('quantity_real', flat=True).first()
        return None if stock is None else int(stock)
    from wholesale.models import WholesaleProduct
    stock = WholesaleProduct.objects.filter(pk=line.product_id).values_list('quantity_real', flat=True).first()
    return None if stock is None else int(stock)


def save_counts(session, rows):
    if session.status != 'OPEN':
        raise ValidationError({'detail': 'Cet inventaire n’est plus modifiable.'})
    by_id = {str(line.id): line for line in session.lines.all()}
    dirty = []
    for row in rows or []:
        line = by_id.get(str(row.get('id') or ''))
        if line is None:
            continue
        raw = row.get('counted_qty', None)
        if raw is None or raw == '':
            line.counted_qty = None
        else:
            try:
                qty = int(raw)
            except (TypeError, ValueError):
                raise ValidationError({'detail': f'Quantité invalide pour {line.product_name}.'})
            if qty < 0:
                raise ValidationError({'detail': f'Quantité invalide pour {line.product_name}.'})
            line.counted_qty = qty
        dirty.append(line)
    if dirty:
        InventoryLine.objects.bulk_update(dirty, ['counted_qty'])
    return session


def serialize_session(session):
    lines = []
    moved = 0
    counted = 0
    for line in session.lines.all():
        current = current_quantity(line)
        gap = None if line.counted_qty is None or current is None else int(line.counted_qty) - int(current)
        if line.counted_qty is not None:
            counted += 1
        if current is not None and int(current) != int(line.theoretical_qty):
            moved += 1
        lines.append({
            'id': str(line.id),
            'product_name': line.product_name,
            'sku': line.sku,
            'batch_number': line.batch_number,
            'expiration_date': line.expiration_date.isoformat() if line.expiration_date else None,
            'theoretical_qty': line.theoretical_qty,
            'current_qty': current,
            'counted_qty': line.counted_qty,
            'gap': gap,
            'stock_moved': current is not None and int(current) != int(line.theoretical_qty),
            'missing': current is None,
        })
    return {
        'id': str(session.id),
        'sector': session.sector,
        'status': session.status,
        'opened_at': session.opened_at.isoformat() if session.opened_at else None,
        'lines': lines,
        'counted_count': counted,
        'moved_count': moved,
    }


@transaction.atomic
def validate_session(session, user, rows=None):
    session = InventorySession.objects.select_for_update().get(pk=session.pk)
    if rows is not None:
        save_counts(session, rows)
    if session.status != 'OPEN':
        raise ValidationError({'detail': 'Cet inventaire n’est plus modifiable.'})
    adjusted = 0
    unchanged = 0
    missing = []
    for line in session.lines.select_for_update():
        if line.counted_qty is None:
            continue
        current = current_quantity(line)
        if current is None:
            missing.append(line.product_name)
            continue
        target = int(line.counted_qty)
        if target == int(current):
            unchanged += 1
            continue
        _align_stock(session, line, target, user)
        adjusted += 1
    if adjusted == 0 and unchanged == 0 and not missing:
        raise ValidationError({'detail': 'Indiquez au moins une quantité comptée.'})
    session.status = 'VALIDATED'
    session.validated_at = timezone.now()
    session.validated_by = user if getattr(user, 'is_authenticated', False) else None
    session.save(update_fields=['status', 'validated_at', 'validated_by'])
    return {'adjusted': adjusted, 'unchanged': unchanged, 'missing': missing}


def cancel_session(session):
    if session.status != 'OPEN':
        raise ValidationError({'detail': 'Cet inventaire n’est plus modifiable.'})
    session.status = 'CANCELLED'
    session.validated_at = timezone.now()
    session.save(update_fields=['status', 'validated_at'])
    return session


def _align_stock(session, line, target, user):
    note = 'Inventaire'
    if session.sector == 'commerce':
        from products.models import Product, ProductVariant, StockMovement
        if line.variant_id:
            variant = ProductVariant.objects.select_for_update().get(pk=line.variant_id)
            old = int(variant.stock or 0)
            variant.stock = target
            variant.save(update_fields=['stock', 'updated_at'])
            product = variant.product
        else:
            product = Product.objects.select_for_update().get(pk=line.product_id)
            variant = None
            old = int(product.stock or 0)
            product.stock = target
            product.save(update_fields=['stock', 'updated_at'])
        StockMovement.objects.create(
            business=session.business,
            product=product,
            variant=variant,
            movement_type='ADJUST',
            quantity=target - old,
            note=f'{note} ({old} → {target})',
        )
        return
    if session.sector == 'retail':
        from retail.models import RetailProduct
        from retail.order_workflow import adjust_stock
        product = RetailProduct.objects.select_for_update().get(pk=line.product_id)
    else:
        from wholesale.models import WholesaleProduct
        from wholesale.order_workflow import adjust_stock
        product = WholesaleProduct.objects.select_for_update().get(pk=line.product_id)
    adjust_stock(product, target, f'{note} ({product.quantity_real} → {target})', user=user)
