from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business
from orders.models import Order, OrderItem
from products.models import Product

User = get_user_model()


class MarginReportTests(TestCase):
    def setUp(self):
        category = BusinessCategory.objects.create(
            name='Boutique marge', slug='boutique-marge', module='commerce',
        )
        self.owner = User.objects.create_user(
            email='marge@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.shop = Business.objects.create(
            owner=self.owner, primary_category=category, name='Boutique Marge',
        )
        self.gain = Product.objects.create(
            business=self.shop, name='Cahier', price=Decimal('1000'),
            purchase_price=Decimal('400'), stock=5,
        )
        self.loss = Product.objects.create(
            business=self.shop, name='Stylo', price=Decimal('100'),
            purchase_price=Decimal('150'), stock=2,
        )
        self.missing = Product.objects.create(
            business=self.shop, name='Règle', price=Decimal('300'),
            purchase_price=Decimal('0'), stock=1,
        )
        order = Order.objects.create(
            business=self.shop, payment_status='PAID', status='COMPLETED',
            paid_at=timezone.now(),
        )
        OrderItem.objects.create(order=order, product=self.gain, product_name='Cahier', quantity=2, price_at_time=Decimal('1000'))
        OrderItem.objects.create(order=order, product=self.loss, product_name='Stylo', quantity=1, price_at_time=Decimal('100'))
        old = Order.objects.create(
            business=self.shop, payment_status='PAID', status='COMPLETED',
            paid_at=timezone.now() - timedelta(days=40),
        )
        OrderItem.objects.create(order=old, product=self.gain, product_name='Cahier', quantity=9, price_at_time=Decimal('1000'))
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_period_profit_ignores_missing_cost_and_older_sales(self):
        today = timezone.localdate()
        response = self.client.get('/api/v1/businesses/me/margins/', {
            'date_from': (today - timedelta(days=7)).isoformat(),
            'date_to': today.isoformat(),
        })
        self.assertEqual(response.status_code, 200, response.content)
        lines = {row['name']: row for row in response.data['lines']}
        self.assertEqual(lines['Cahier']['kind'], 'PROFIT')
        self.assertEqual(lines['Cahier']['unit_margin'], '600.00')
        self.assertEqual(lines['Cahier']['sold_quantity'], 2)
        self.assertEqual(lines['Cahier']['period_profit'], '1200.00')
        self.assertEqual(lines['Cahier']['stock_margin'], '3000.00')
        self.assertEqual(lines['Stylo']['kind'], 'LOSS')
        self.assertEqual(lines['Stylo']['period_profit'], '-50.00')
        self.assertEqual(lines['Règle']['kind'], 'MISSING')
        self.assertIsNone(lines['Règle']['period_profit'])
        self.assertEqual(response.data['period_profit'], '1150.00')
        self.assertEqual(response.data['missing_count'], 1)
