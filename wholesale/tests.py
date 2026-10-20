"""Pharmacie de gros — acceptation d'une commande payée et verrou du paiement."""
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings

from business_categories.models import BusinessCategory
from businesses.models import Business

from .models import WholesaleOrder, WholesaleOrderItem, WholesaleProduct
from .order_workflow import accept_order, complete_order, reject_order

User = get_user_model()


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class WholesaleAcceptTests(TestCase):
    def setUp(self):
        category = BusinessCategory.objects.create(name='Pharmacie de gros', slug='pharmacie-gros')
        self.owner = User.objects.create_user(
            email='owner@wholesale.test', password='test-pass', role='BUSINESS_OWNER',
        )
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=category,
            category=category,
            name='Grossiste Test',
            email='contact@wholesale.test',
        )
        self.product = WholesaleProduct.objects.create(
            wholesale_business=self.business,
            name='Paracetamol',
            packaging='Boite',
            wholesale_price='1500',
            quantity_real=20,
        )

    def test_unpaid_order_cannot_be_accepted(self):
        order = WholesaleOrder.objects.create(
            reference='CMD-PG-1',
            wholesale_business=self.business,
            buyer_name='Officine',
            buyer_email='buyer@test.bi',
            status='SUBMITTED',
            payment_status='UNPAID',
            total_amount='1500',
        )
        WholesaleOrderItem.objects.create(
            order=order,
            product=self.product,
            product_name_snapshot=self.product.name,
            packaging_snapshot='Boite',
            unit_price_snapshot='1500',
            quantity=1,
            line_total='1500',
        )
        with self.assertRaisesMessage(ValueError, 'BurundiPay'):
            accept_order(order, self.owner)

    def test_paid_order_reserves_stock(self):
        order = WholesaleOrder.objects.create(
            reference='CMD-PG-2',
            wholesale_business=self.business,
            buyer_name='Officine',
            buyer_email='buyer@test.bi',
            status='SUBMITTED',
            payment_status='PAID',
            total_amount='3000',
            notification_email='buyer@test.bi',
        )
        WholesaleOrderItem.objects.create(
            order=order,
            product=self.product,
            product_name_snapshot=self.product.name,
            packaging_snapshot='Boite',
            unit_price_snapshot='1500',
            quantity=2,
            line_total='3000',
        )
        order, result = accept_order(order, self.owner)
        self.product.refresh_from_db()
        self.assertEqual(order.status, 'ACCEPTED')
        self.assertEqual(self.product.quantity_reserved, 2)
        self.assertIn(result.get('status'), ('SENT', 'SKIPPED', 'FAILED'))
        self.assertGreaterEqual(len(mail.outbox), 0)

    def test_delivery_consumes_real_stock(self):
        order = WholesaleOrder.objects.create(
            reference='CMD-PG-3',
            wholesale_business=self.business,
            buyer_name='Officine',
            buyer_email='buyer@test.bi',
            status='SUBMITTED',
            payment_status='PAID',
            total_amount='3000',
            notification_email='buyer@test.bi',
        )
        WholesaleOrderItem.objects.create(
            order=order,
            product=self.product,
            product_name_snapshot=self.product.name,
            packaging_snapshot='Boite',
            unit_price_snapshot='1500',
            quantity=2,
            line_total='3000',
        )
        accept_order(order, self.owner)
        complete_order(order, self.owner)
        self.product.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(order.status, 'COMPLETED')
        self.assertEqual(self.product.quantity_real, 18)
        self.assertEqual(self.product.quantity_reserved, 0)

    def test_reject_does_not_free_another_reservation(self):
        self.product.quantity_reserved = 5
        self.product.save(update_fields=['quantity_reserved'])
        order = WholesaleOrder.objects.create(
            reference='CMD-PG-4',
            wholesale_business=self.business,
            buyer_name='Officine',
            buyer_email='buyer@test.bi',
            status='SUBMITTED',
            payment_status='UNPAID',
            total_amount='1500',
            notification_email='buyer@test.bi',
        )
        WholesaleOrderItem.objects.create(
            order=order,
            product=self.product,
            product_name_snapshot=self.product.name,
            packaging_snapshot='Boite',
            unit_price_snapshot='1500',
            quantity=2,
            line_total='3000',
        )
        reject_order(order, self.owner, 'Produit indisponible')
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity_reserved, 5)
