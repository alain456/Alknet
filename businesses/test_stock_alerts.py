from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business, StockAlert
from django.contrib.auth import get_user_model
from products.models import Product
from retail.models import RetailProduct
from wholesale.models import WholesaleProduct

User = get_user_model()


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class StockAlertTests(TestCase):
    def setUp(self):
        self.category = BusinessCategory.objects.create(name='Pharmacie de détail', slug='pharma-alert')
        self.owner = User.objects.create_user(
            email='owner-stock@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            name='Pharmacie Alerte',
            email='pharmacie-alerte@test.bi',
            phone='67000000',
        )
        self.retail = RetailProduct.objects.create(
            retail_business=self.business,
            name='Paracétamol',
            packaging='Boîte de 20',
            quantity_real=40,
            low_stock_threshold=10,
        )
        self.product = Product.objects.create(
            business=self.business,
            name='Cahier',
            price=1000,
            stock=20,
            low_stock_threshold=5,
        )
        self.wholesale = WholesaleProduct.objects.create(
            wholesale_business=self.business,
            name='Amoxicilline',
            packaging='Boîte de 100',
            quantity_real=30,
            low_stock_threshold=8,
        )

    def test_retail_notifies_on_low_then_out_and_clears_on_restock(self):
        self.assertEqual(StockAlert.objects.count(), 0)
        with self.captureOnCommitCallbacks(execute=True):
            self.retail.quantity_real = 4
            self.retail.save(update_fields=['quantity_real', 'updated_at'])
        low = StockAlert.objects.get(product_id=self.retail.id, is_resolved=False)
        self.assertEqual(low.level, 'LOW')
        self.assertEqual(low.quantity, 4)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Stock faible', mail.outbox[0].subject)
        self.assertIn('pharmacie-alerte@test.bi', mail.outbox[0].to)

        with self.captureOnCommitCallbacks(execute=True):
            self.retail.quantity_real = 3
            self.retail.save(update_fields=['quantity_real', 'updated_at'])
        self.assertEqual(StockAlert.objects.filter(product_id=self.retail.id, is_resolved=False).count(), 1)
        self.assertEqual(len(mail.outbox), 1)

        with self.captureOnCommitCallbacks(execute=True):
            self.retail.quantity_real = 0
            self.retail.save(update_fields=['quantity_real', 'updated_at'])
        out = StockAlert.objects.get(product_id=self.retail.id, is_resolved=False)
        self.assertEqual(out.level, 'OUT')
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn('Rupture', mail.outbox[1].subject)

        with self.captureOnCommitCallbacks(execute=True):
            self.retail.quantity_real = 40
            self.retail.save(update_fields=['quantity_real', 'updated_at'])
        self.assertFalse(StockAlert.objects.filter(product_id=self.retail.id, is_resolved=False).exists())
        self.assertEqual(len(mail.outbox), 2)

    def test_reservation_can_trigger_a_low_stock_alert(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.retail.quantity_reserved = 36
            self.retail.save(update_fields=['quantity_reserved', 'updated_at'])
        alert = StockAlert.objects.get(product_id=self.retail.id, is_resolved=False)
        self.assertEqual(alert.level, 'LOW')
        self.assertEqual(alert.quantity, 4)

    def test_commerce_and_wholesale_follow_the_same_rule(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.product.stock = 2
            self.product.save(update_fields=['stock', 'updated_at'])
            self.wholesale.quantity_real = 0
            self.wholesale.save(update_fields=['quantity_real', 'updated_at'])
        self.assertEqual(
            StockAlert.objects.get(product_id=self.product.id, is_resolved=False).sector,
            'commerce',
        )
        self.assertEqual(
            StockAlert.objects.get(product_id=self.wholesale.id, is_resolved=False).level,
            'OUT',
        )

    def test_admin_can_list_and_mark_alerts_read(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.product.stock = 1
            self.product.save(update_fields=['stock', 'updated_at'])
        client = APIClient()
        client.force_authenticate(self.owner)
        listed = client.get('/api/v1/businesses/me/stock-alerts/')
        self.assertEqual(listed.status_code, 200, listed.content)
        self.assertEqual(listed.data['unread_count'], 1)
        self.assertIn('Cahier', listed.data['results'][0]['product_name'])
        marked = client.post('/api/v1/businesses/me/stock-alerts/', {'all': True}, format='json')
        self.assertEqual(marked.status_code, 200, marked.content)
        self.assertEqual(marked.data['unread_count'], 0)
