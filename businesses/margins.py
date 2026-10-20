"""Prix d'achat, prix de vente et bénéfice pour le commerce et les pharmacies."""
from datetime import datetime, time
from decimal import Decimal

from django.db.models import Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from .inventory import stock_sector


def _money(value):
    return str(Decimal(value or 0).quantize(Decimal('0.01')))


def _period(params):
    today = timezone.localdate()
    start = parse_date(params.get('date_from') or '') or today.replace(day=1)
    end = parse_date(params.get('date_to') or '') or today
    if start > end:
        raise ValidationError({'detail': 'La date de début est après la date de fin.'})
    start_at = timezone.make_aware(datetime.combine(start, time.min))
    end_at = timezone.make_aware(datetime.combine(end, time.max))
    return start, end, start_at, end_at


def _kind(purchase, sale):
    if purchase is None or purchase <= 0:
        return 'MISSING'
    if sale < purchase:
        return 'LOSS'
    return 'PROFIT'


def margin_report(business, params):
    sector = stock_sector(business)
    if not sector:
        raise ValidationError({'detail': 'Les marges concernent le commerce et les pharmacies.'})
    date_from, date_to, start_at, end_at = _period(params)
    sold = _sold_by_product(business, sector, start_at, end_at)
    lines = []
    period_profit = Decimal('0')
    period_revenue = Decimal('0')
    period_cost = Decimal('0')
    stock_purchase = Decimal('0')
    stock_potential = Decimal('0')
    missing = 0
    for row in _catalog(business, sector):
        purchase = Decimal(row['purchase_price'] or 0)
        sale = Decimal(row['sale_price'] or 0)
        qty = int(row['quantity'] or 0)
        movement = sold.get(row['id'], {'qty': 0, 'revenue': Decimal('0')})
        sold_qty = int(movement['qty'])
        revenue = Decimal(movement['revenue'])
        kind = _kind(purchase, sale)
        unit_margin = None if kind == 'MISSING' else sale - purchase
        stock_margin = None if kind == 'MISSING' else unit_margin * qty
        if kind == 'MISSING':
            missing += 1
            sold_profit = None
        else:
            cost = purchase * sold_qty
            sold_profit = revenue - cost
            period_profit += sold_profit
            period_revenue += revenue
            period_cost += cost
            stock_purchase += purchase * qty
            stock_potential += stock_margin
        lines.append({
            'id': str(row['id']),
            'name': row['name'],
            'purchase_price': _money(purchase),
            'sale_price': _money(sale),
            'unit_margin': None if unit_margin is None else _money(unit_margin),
            'quantity': qty,
            'stock_margin': None if stock_margin is None else _money(stock_margin),
            'sold_quantity': sold_qty,
            'period_profit': None if sold_profit is None else _money(sold_profit),
            'kind': kind,
        })
    lines.sort(key=lambda row: (row['kind'] != 'LOSS', row['kind'] != 'MISSING', row['name'].lower()))
    return {
        'sector': sector,
        'date_from': date_from.isoformat(),
        'date_to': date_to.isoformat(),
        'missing_count': missing,
        'period_profit': _money(period_profit),
        'period_revenue': _money(period_revenue),
        'period_cost': _money(period_cost),
        'stock_purchase_value': _money(stock_purchase),
        'stock_potential_profit': _money(stock_potential),
        'lines': lines,
    }


def _catalog(business, sector):
    if sector == 'commerce':
        from products.models import Product
        rows = []
        for product in Product.objects.filter(business=business):
            rows.append({
                'id': product.id,
                'name': product.name,
                'purchase_price': product.purchase_price,
                'sale_price': product.effective_price,
                'quantity': product.stock_available(),
            })
        return rows
    if sector == 'retail':
        products = business.retail_products.exclude(status='ARCHIVED')
        sale = 'retail_price'
    else:
        products = business.wholesale_products.exclude(status='ARCHIVED')
        sale = 'wholesale_price'
    return [
        {
            'id': product.id,
            'name': product.name,
            'purchase_price': product.purchase_price,
            'sale_price': getattr(product, sale),
            'quantity': product.quantity_real,
        }
        for product in products
    ]


def _sold_by_product(business, sector, start_at, end_at):
    if sector == 'commerce':
        from orders.models import OrderItem
        qs = OrderItem.objects.filter(
            order__business=business,
            order__payment_status='PAID',
            product_id__isnull=False,
        ).exclude(order__status__in=['CANCELLED', 'REJECTED']).annotate(
            when=Coalesce('order__paid_at', 'order__created_at'),
        ).filter(when__gte=start_at, when__lte=end_at)
        key = 'product_id'
        price = 'price_at_time'
    elif sector == 'retail':
        from retail.models import RetailOrderItem
        qs = RetailOrderItem.objects.filter(
            order__retail_business=business,
            order__payment_status='PAID',
            product_id__isnull=False,
        ).exclude(order__status__in=['CANCELLED', 'REJECTED']).annotate(
            when=Coalesce('order__paid_at', 'order__created_at'),
        ).filter(when__gte=start_at, when__lte=end_at)
        key = 'product_id'
        price = 'unit_price_snapshot'
    else:
        from wholesale.models import WholesaleOrderItem
        qs = WholesaleOrderItem.objects.filter(
            Q(order__wholesale_business=business),
            order__payment_status='PAID',
            product_id__isnull=False,
        ).exclude(order__status__in=['CANCELLED', 'REJECTED']).annotate(
            when=Coalesce('order__paid_at', 'order__created_at'),
        ).filter(when__gte=start_at, when__lte=end_at)
        key = 'product_id'
        price = 'unit_price_snapshot'
    totals = {}
    for item in qs:
        bucket = totals.setdefault(getattr(item, key), {'qty': 0, 'revenue': Decimal('0')})
        bucket['qty'] += int(item.quantity or 0)
        bucket['revenue'] += Decimal(getattr(item, price) or 0) * int(item.quantity or 0)
    return totals
