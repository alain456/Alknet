from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
import json

from business_categories.models import BusinessCategory
from businesses.models import Business

from .models import Prescription, ProformaInvoice, RetailProduct
from .order_workflow import (
    accept_order,
    create_order_from_items,
    create_order_proforma,
    request_clarification,
)


User = get_user_model()


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class RetailWorkflowTests(TestCase):
    def setUp(self):
        category = BusinessCategory.objects.create(
            name='Pharmacie de détail', slug='pharmacie-detail'
        )
        self.owner = User.objects.create_user(
            email='owner@retail.test', password='test-pass', role='BUSINESS_OWNER'
        )
        self.patient = User.objects.create_user(
            email='patient@retail.test', password='test-pass', role='CUSTOMER',
            first_name='Patient',
        )
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=category,
            category=category,
            name='Pharmacie Test',
            email='contact@retail.test',
        )
        self.product = RetailProduct.objects.create(
            retail_business=self.business,
            name='Produit Test',
            packaging='Boite',
            sales_unit='Boite',
            retail_price='2500',
            quantity_real=10,
        )

    def create_order(self):
        order = create_order_from_items(
            self.business,
            [{'product_id': str(self.product.id), 'quantity': 2}],
            'Patient', self.patient.email,
            patient=self.patient, user=self.patient,
        )
        create_order_proforma(order)
        return order

    def test_accept_reserves_stock_confirms_proforma_and_emails(self):
        order = self.create_order()
        order, result = accept_order(order, self.owner)
        self.product.refresh_from_db()
        order.proforma.refresh_from_db()

        self.assertEqual(order.status, 'ACCEPTED')
        self.assertEqual(self.product.quantity_reserved, 2)
        self.assertEqual(order.proforma.status, 'CONFIRMED')
        self.assertEqual(result['status'], 'SENT')
        self.assertEqual(len(mail.outbox), 1)

    def test_clarification_requires_comment(self):
        order = self.create_order()
        with self.assertRaisesMessage(ValueError, 'commentaire'):
            request_clarification(order, self.owner, '')

        request_clarification(order, self.owner, 'Photo ordonnance plus lisible.')
        order.refresh_from_db()
        self.assertEqual(order.status, 'CLARIFICATION_REQUESTED')

    def test_public_products_ignore_invalid_jwt(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = client.get('/api/v1/retail/products/?public=true')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_guest_checkout_creates_patient_order_and_proforma(self):
        response = APIClient().post(
            '/api/v1/retail/guest-checkout/',
            {
                'pharmacy_id': str(self.business.id),
                'patient_name': 'Guest Patient',
                'patient_email': 'guest@example.com',
                'patient_phone': '+257000000',
                'payment_method': 'BURUNDIPAY',
                'payer_phone': '79123456',
                'items': [{'product_id': str(self.product.id), 'quantity': 1}],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['reference'].startswith('CMD-PD-'))
        self.assertEqual(response.data.get('payment_method'), 'BURUNDIPAY')
        self.assertTrue(response.data.get('payer_phone'))
        self.assertIn(response.data.get('payment_status'), ('AWAITING_PIN', 'PAID'))
        self.assertTrue(
            ProformaInvoice.objects.filter(order_id=response.data['id']).exists()
        )

    def test_guest_checkout_prescription_file_upload(self):
        self.product.prescription_required = True
        self.product.save(update_fields=['prescription_required'])
        pdf = SimpleUploadedFile(
            'ordonnance.pdf',
            b'%PDF-1.4 test ordonnance',
            content_type='application/pdf',
        )
        response = APIClient().post(
            '/api/v1/retail/guest-checkout/',
            {
                'pharmacy_id': str(self.business.id),
                'patient_name': 'Guest Rx',
                'patient_email': 'guest-rx@example.com',
                'payment_method': 'BURUNDIPAY',
                'payer_phone': '79123456',
                'items': json.dumps([{'product_id': str(self.product.id), 'quantity': 1}]),
                'prescription_file': pdf,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 201, response.content)
        rx = Prescription.objects.filter(order_id=response.data['id']).first()
        self.assertIsNotNone(rx)
        self.assertTrue(bool(rx.file))
        self.assertTrue((rx.file_url or '').startswith('/media/') or bool(rx.file.name))
