from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business
from services.models import Service
from site_content.models import ContactMessage

User = get_user_model()


class AdminDashboardQueueAndSearchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='super-queue@test.bi', password='Pass123456!', role='SUPER_ADMIN',
            first_name='Super', last_name='Admin',
        )
        self.finance = User.objects.create_user(
            email='finance-queue@test.bi', password='Pass123456!', role='PLATFORM_FINANCE',
        )
        self.support = User.objects.create_user(
            email='support-queue@test.bi', password='Pass123456!', role='PLATFORM_SUPPORT',
            first_name='Aide', last_name='Hub',
        )
        self.owner = User.objects.create_user(
            email='owner-queue@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
            first_name='Aline', last_name='Ndayishimiye',
        )
        category = BusinessCategory.objects.create(name='Commerce test', slug='commerce-queue')
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=category,
            name='Boutique Karera',
            email='karera@test.bi',
            verification_status='PENDING',
            is_verified=False,
        )
        Service.objects.create(
            business=self.business,
            title='Livraison express Karera',
            description='Course en ville',
            status='DRAFT',
        )
        ContactMessage.objects.create(
            name='Client Karera',
            email='client.karera@test.bi',
            subject='Question boutique Karera',
            message='Le colis est-il parti ?',
        )

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_dashboard_queue_counts(self):
        self._login(self.admin)
        response = self.client.get('/api/v1/analytics/dashboard-stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        queue = response.data.get('queue') or {}
        self.assertGreaterEqual(queue.get('pending_businesses'), 1)
        self.assertGreaterEqual(queue.get('contact_unread'), 1)
        self.assertGreaterEqual(queue.get('services_draft'), 1)
        self.assertIn('subscriptions_grace', queue)
        self.assertIn('subscriptions_expired', queue)

    def test_admin_search_returns_businesses_users_and_messages(self):
        self._login(self.admin)
        response = self.client.get('/api/v1/analytics/admin-search/', {'q': 'Karera'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        groups = {row['key']: row for row in response.data.get('groups') or []}
        self.assertIn('businesses', groups)
        self.assertIn('messages', groups)
        self.assertTrue(any('Boutique Karera' in item['title'] for item in groups['businesses']['items']))
        self.assertTrue(any('Question boutique Karera' in item['title'] for item in groups['messages']['items']))

        users = self.client.get('/api/v1/analytics/admin-search/', {'q': 'Aline'})
        user_groups = {row['key']: row for row in users.data.get('groups') or []}
        self.assertIn('users', user_groups)
        self.assertTrue(any('Aline' in item['title'] for item in user_groups['users']['items']))

    def test_support_search_hides_businesses(self):
        self._login(self.support)
        response = self.client.get('/api/v1/analytics/admin-search/', {'q': 'Karera'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        keys = [row['key'] for row in response.data.get('groups') or []]
        self.assertNotIn('businesses', keys)
        self.assertIn('messages', keys)

    def test_finance_can_call_search_without_catalog_hits(self):
        self._login(self.finance)
        response = self.client.get('/api/v1/analytics/admin-search/', {'q': 'Karera'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        keys = [row['key'] for row in response.data.get('groups') or []]
        self.assertEqual(keys, [])
