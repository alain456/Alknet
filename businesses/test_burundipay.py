"""Tests client BurundiPay (stub + parsing live mocké)."""
from django.test import SimpleTestCase, override_settings

from businesses import burundipay


@override_settings(BURUNDIPAY_STUB=True, DEBUG=True)
class BurundiPayStubTests(SimpleTestCase):
    def test_stub_collection_awaiting_pin(self):
        result = burundipay.initiate_collection(
            amount_bif=5000,
            payer_phone='79556677',
            external_id='test-1',
            description='Test',
        )
        self.assertTrue(result['ok'])
        self.assertEqual(result['status'], 'AWAITING_PIN')
        self.assertTrue(str(result['provider_reference']).startswith('STUB-BP-'))

    def test_stub_refund(self):
        result = burundipay.refund_collection(
            amount_bif=5000,
            payer_phone='25779556677',
            provider_reference='STUB-BP-ABC',
            external_id='test-1',
            description='Refund test',
        )
        self.assertTrue(result['ok'])
        self.assertEqual(result['status'], 'REFUNDED')
        self.assertTrue(str(result['refund_reference']).startswith('STUB-REF-'))

    def test_normalize_phone(self):
        self.assertEqual(burundipay.normalize_phone('79556677'), '25779556677')
        self.assertEqual(burundipay.normalize_phone('+257 79 55 66 77'), '25779556677')


@override_settings(
    BURUNDIPAY_STUB=False,
    BURUNDIPAY_API_URL='https://api.example-burundipay.test',
    BURUNDIPAY_API_KEY='test-key',
    BURUNDIPAY_COLLECT_PATH='/v1/collections',
    BURUNDIPAY_REFUND_PATH='/v1/refunds',
    BURUNDIPAY_STATUS_PATH='/v1/collections/{id}',
    DEBUG=True,
)
class BurundiPayLiveMockTests(SimpleTestCase):
    def test_live_collect_maps_pending(self):
        def fake_http(method, path, payload=None):
            self.assertEqual(method, 'POST')
            self.assertIn('/v1/collections', path)
            return {
                'http_status': 201,
                'id': 'TXN-99',
                'status': 'PENDING',
                'message': 'PIN envoyé',
            }

        original = burundipay._http_json
        burundipay._http_json = fake_http
        try:
            result = burundipay.initiate_collection(
                amount_bif=1000,
                payer_phone='79556677',
                external_id='ext-1',
                description='Live test',
            )
        finally:
            burundipay._http_json = original

        self.assertTrue(result['ok'])
        self.assertEqual(result['status'], 'AWAITING_PIN')
        self.assertEqual(result['provider_reference'], 'TXN-99')
        self.assertFalse(result['stub_mode'])

    def test_live_refund_success(self):
        def fake_http(method, path, payload=None):
            self.assertEqual(method, 'POST')
            self.assertIn('/v1/refunds', path)
            return {
                'http_status': 200,
                'id': 'REF-1',
                'status': 'SUCCESS',
            }

        original = burundipay._http_json
        burundipay._http_json = fake_http
        try:
            result = burundipay.refund_collection(
                amount_bif=1000,
                payer_phone='25779556677',
                provider_reference='TXN-99',
                external_id='ext-1',
            )
        finally:
            burundipay._http_json = original

        self.assertTrue(result['ok'])
        self.assertEqual(result['status'], 'REFUNDED')
        self.assertEqual(result['refund_reference'], 'REF-1')
