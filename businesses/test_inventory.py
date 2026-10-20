from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business, InventorySession, StockAlert
from products.models import Product, ProductVariant, StockMovement
from retail.models import RetailProduct
from retail.models import StockMovement as RetailStockMovement

User = get_user_model()


class InventorySessionTests(TestCase):
    def setUp(self):
        self.commerce_category = BusinessCategory.objects.create(
            name='Boutique inventaire', slug='boutique-inventaire', module='commerce',
        )
        self.retail_category = BusinessCategory.objects.create(
            name='Pharmacie inventaire', slug='pharmacie-inventaire', module='retail_pharmacy',
        )
        self.owner = User.objects.create_user(
            email='owner-inventaire@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.pharmacist = User.objects.create_user(
            email='pharmacien-inventaire@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.shop = Business.objects.create(
            owner=self.owner, primary_category=self.commerce_category, name='Boutique Inventaire',
        )
        self.pharmacy = Business.objects.create(
            owner=self.pharmacist, primary_category=self.retail_category, name='Pharmacie Inventaire',
        )
        self.plain = Product.objects.create(
            business=self.shop, name='Cahier', price=1000, stock=10, sku='CAH',
        )
        self.shirt = Product.objects.create(
            business=self.shop, name='Chemise', price=5000, stock=0,
        )
        self.red = ProductVariant.objects.create(product=self.shirt, color='Rouge', stock=4)
        self.medicine = RetailProduct.objects.create(
            retail_business=self.pharmacy,
            name='Paracétamol',
            packaging='Boîte',
            quantity_real=20,
            quantity_reserved=2,
            low_stock_threshold=5,
            batch_number='LOT-9',
            expiration_date='2027-01-15',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_commerce_recalculates_the_gap_against_current_stock(self):
        opened = self.client.post('/api/v1/businesses/me/inventory/', {}, format='json')
        self.assertEqual(opened.status_code, 201, opened.content)
        lines = {row['product_name']: row for row in opened.data['session']['lines']}
        self.assertEqual(lines['Cahier']['theoretical_qty'], 10)
        self.assertEqual(lines['Chemise — Rouge']['theoretical_qty'], 4)
        self.assertEqual(lines['Chemise — Rouge']['sku'], '')

        self.plain.stock = 8
        self.plain.save(update_fields=['stock', 'updated_at'])
        listed = self.client.get('/api/v1/businesses/me/inventory/')
        cahier = next(row for row in listed.data['session']['lines'] if row['product_name'] == 'Cahier')
        self.assertEqual(cahier['current_qty'], 8)
        self.assertTrue(cahier['stock_moved'])

        again = self.client.post('/api/v1/businesses/me/inventory/', {}, format='json')
        self.assertEqual(again.status_code, 400)

        validated = self.client.post('/api/v1/businesses/me/inventory/validate/', {
            'lines': [
                {'id': lines['Cahier']['id'], 'counted_qty': 7},
                {'id': lines['Chemise — Rouge']['id'], 'counted_qty': 4},
            ],
        }, format='json')
        self.assertEqual(validated.status_code, 200, validated.content)
        self.assertEqual(validated.data['adjusted'], 1)
        self.assertEqual(validated.data['unchanged'], 1)
        self.plain.refresh_from_db()
        self.red.refresh_from_db()
        self.assertEqual(self.plain.stock, 7)
        self.assertEqual(self.red.stock, 4)
        movement = StockMovement.objects.get(product=self.plain, movement_type='ADJUST')
        self.assertIn('Inventaire', movement.note)
        self.assertEqual(movement.quantity, -1)
        self.assertFalse(InventorySession.objects.filter(business=self.shop, status='OPEN').exists())

    def test_pharmacy_count_sets_real_stock_and_keeps_reservations(self):
        self.client.force_authenticate(self.pharmacist)
        opened = self.client.post('/api/v1/businesses/me/inventory/', {}, format='json')
        self.assertEqual(opened.status_code, 201, opened.content)
        self.assertEqual(opened.data['session']['sector'], 'retail')
        line = opened.data['session']['lines'][0]
        self.assertEqual(line['batch_number'], 'LOT-9')
        self.assertEqual(line['expiration_date'], '2027-01-15')
        self.assertEqual(line['theoretical_qty'], 20)

        validated = self.client.post('/api/v1/businesses/me/inventory/validate/', {
            'lines': [{'id': line['id'], 'counted_qty': 3}],
        }, format='json')
        self.assertEqual(validated.status_code, 200, validated.content)
        self.medicine.refresh_from_db()
        self.assertEqual(self.medicine.quantity_real, 3)
        self.assertEqual(self.medicine.quantity_reserved, 2)
        movement = RetailStockMovement.objects.get(product=self.medicine)
        self.assertIn('Inventaire', movement.reason)
        self.assertTrue(StockAlert.objects.filter(product_id=self.medicine.id, level='LOW', is_resolved=False).exists())

    def test_blank_lines_are_left_unchanged_and_cancel_drops_the_session(self):
        opened = self.client.post('/api/v1/businesses/me/inventory/', {}, format='json')
        lines = opened.data['session']['lines']
        empty = self.client.post('/api/v1/businesses/me/inventory/validate/', {'lines': []}, format='json')
        self.assertEqual(empty.status_code, 400)
        cancelled = self.client.post('/api/v1/businesses/me/inventory/cancel/', {}, format='json')
        self.assertEqual(cancelled.status_code, 200)
        self.plain.refresh_from_db()
        self.assertEqual(self.plain.stock, 10)
        self.assertEqual(len(lines), 2)
