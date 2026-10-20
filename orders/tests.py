from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from business_categories.models import BusinessCategory
from businesses.models import Business
from products.models import Product, StockMovement

from .models import Order, OrderItem
from .views import _adjust_stock

User = get_user_model()


class CommerceStockLockTests(TestCase):
    def setUp(self):
        category = BusinessCategory.objects.create(name='Boutique', slug='boutique-stock')
        owner = User.objects.create_user(email='shop@stock.test', password='test-pass', role='BUSINESS_OWNER')
        self.business = Business.objects.create(
            owner=owner, primary_category=category, category=category,
            name='Boutique Stock', email='shop@stock.test',
        )
        self.product = Product.objects.create(
            business=self.business, name='Cahier', price='1000', stock=1,
        )

    def test_checkout_refuses_when_stock_is_short(self):
        order = Order.objects.create(business=self.business, status='PENDING', reference_code='CMD-1')
        OrderItem.objects.create(
            order=order, product=self.product, product_name='Cahier', quantity=3, price_at_time='1000',
        )
        with self.assertRaises(ValidationError):
            with transaction.atomic():
                _adjust_stock(order, -1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 1)
        self.assertFalse(StockMovement.objects.filter(product=self.product, movement_type='SALE').exists())

    def test_sale_writes_a_movement(self):
        order = Order.objects.create(business=self.business, status='PENDING', reference_code='CMD-2')
        OrderItem.objects.create(
            order=order, product=self.product, product_name='Cahier', quantity=1, price_at_time='1000',
        )
        with transaction.atomic():
            _adjust_stock(order, -1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)
        self.assertTrue(StockMovement.objects.filter(product=self.product, movement_type='SALE', quantity=-1).exists())
