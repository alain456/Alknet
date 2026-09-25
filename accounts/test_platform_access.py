from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

User = get_user_model()


class PlatformRoleAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.finance = User.objects.create_user(
            email='finance-platform@test.bi', password='Pass123456!', role='PLATFORM_FINANCE',
        )
        self.moderation = User.objects.create_user(
            email='moderation-platform@test.bi', password='Pass123456!', role='PLATFORM_MODERATION',
        )
        self.support = User.objects.create_user(
            email='support-platform@test.bi', password='Pass123456!', role='PLATFORM_SUPPORT',
        )
        self.admin = User.objects.create_user(
            email='super-platform@test.bi', password='Pass123456!', role='SUPER_ADMIN',
        )

    def _login(self, email):
        login = self.client.post('/api/v1/accounts/login/', {
            'email': email, 'password': 'Pass123456!',
        }, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_finance_reads_billing_and_cannot_change_grace(self):
        self._login('finance-platform@test.bi')
        listing = self.client.get('/api/v1/businesses/admin/subscriptions/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        denied = self.client.patch(
            '/api/v1/businesses/admin/subscription-settings/',
            {'grace_period_days': 3},
            format='json',
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_moderation_lists_pending_and_cannot_export_rights(self):
        self._login('moderation-platform@test.bi')
        pending = self.client.get('/api/v1/businesses/admin/moderation/')
        self.assertEqual(pending.status_code, status.HTTP_200_OK)
        payments = self.client.get('/api/v1/businesses/admin/subscription-payments/')
        self.assertEqual(payments.status_code, status.HTTP_403_FORBIDDEN)

    def test_support_reads_audit_and_cannot_approve(self):
        self._login('support-platform@test.bi')
        logs = self.client.get('/api/v1/accounts/admin/audit-logs/')
        self.assertEqual(logs.status_code, status.HTTP_200_OK)
        denied = self.client.post('/api/v1/businesses/admin/moderation/00000000-0000-0000-0000-000000000000/approve/', {}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_edits_finance_crud(self):
        self._login('super-platform@test.bi')
        listing = self.client.get('/api/v1/accounts/admin/platform-roles/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        codes = [row['code'] for row in listing.data['results']]
        self.assertIn('finance', codes)
        locked = next(row for row in listing.data['results'] if row['code'] == 'super_admin')
        self.assertTrue(locked['is_locked'])
        updated = self.client.patch(
            '/api/v1/accounts/admin/platform-roles/finance/',
            {'permissions': ['platform.billing.view']},
            format='json',
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data['permissions'], ['platform.billing.view'])
        blocked = self.client.patch(
            '/api/v1/accounts/admin/platform-roles/super_admin/',
            {'permissions': []},
            format='json',
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_actor_and_assign_role(self):
        self._login('super-platform@test.bi')
        created = self.client.post('/api/v1/accounts/admin/platform-actors/', {
            'email': 'new-finance@test.bi',
            'password': 'Pass123456!',
            'first_name': 'Aline',
            'last_name': 'Ndayi',
            'role_code': 'finance',
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data['role'], 'PLATFORM_FINANCE')
        self.assertEqual(created.data['role_code'], 'finance')
        actor_id = created.data['id']

        listing = self.client.get('/api/v1/accounts/admin/platform-actors/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        emails = [row['email'] for row in listing.data['results']]
        self.assertIn('new-finance@test.bi', emails)

        reassigned = self.client.patch(
            f'/api/v1/accounts/admin/platform-actors/{actor_id}/',
            {'role_code': 'moderation'},
            format='json',
        )
        self.assertEqual(reassigned.status_code, status.HTTP_200_OK)
        self.assertEqual(reassigned.data['role'], 'PLATFORM_MODERATION')

        detail = self.client.get(f'/api/v1/accounts/admin/platform-actors/{actor_id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data['email'], 'new-finance@test.bi')

        edited = self.client.patch(
            f'/api/v1/accounts/admin/platform-actors/{actor_id}/',
            {
                'first_name': 'Aline',
                'last_name': 'Munezero',
                'phone_number': '79000000',
                'email': 'aline.moderation@test.bi',
                'password': 'NewPass123456!',
            },
            format='json',
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK, edited.data)
        self.assertEqual(edited.data['email'], 'aline.moderation@test.bi')
        self.assertEqual(edited.data['last_name'], 'Munezero')

        self._login('finance-platform@test.bi')
        denied = self.client.post('/api/v1/accounts/admin/platform-actors/', {
            'email': 'nope@test.bi',
            'password': 'Pass123456!',
            'role_code': 'support',
        }, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self._login('super-platform@test.bi')
        deleted = self.client.delete(f'/api/v1/accounts/admin/platform-actors/{actor_id}/')
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        missing = self.client.get(f'/api/v1/accounts/admin/platform-actors/{actor_id}/')
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

    def test_users_and_audit_scope_split(self):
        from accounts.models import AuditLog
        from accounts.platform_access import update_platform_role

        owner = User.objects.create_user(
            email='owner-scope@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        AuditLog.objects.create(
            user=self.admin,
            user_email=self.admin.email,
            user_role='SUPER_ADMIN',
            action='PLATFORM_ROLE_UPDATED',
            resource='finance',
            status='SUCCESS',
        )
        AuditLog.objects.create(
            user=owner,
            user_email=owner.email,
            user_role='BUSINESS_OWNER',
            action='TENANT_LOGIN_SUCCESS',
            resource='session',
            status='SUCCESS',
        )
        AuditLog.objects.create(
            user=self.moderation,
            user_email=self.moderation.email,
            user_role='PLATFORM_MODERATION',
            action='BUSINESS_APPROVED',
            resource='biz:1',
            status='SUCCESS',
        )

        self._login('super-platform@test.bi')
        update_platform_role('moderation', name='Modérateur dynamique')

        platform_users = self.client.get('/api/v1/accounts/admin/users/?scope=platform')
        self.assertEqual(platform_users.status_code, status.HTTP_200_OK)
        platform_roles = {row['role'] for row in platform_users.data}
        self.assertIn('SUPER_ADMIN', platform_roles)
        self.assertIn('PLATFORM_FINANCE', platform_roles)
        self.assertNotIn('BUSINESS_OWNER', platform_roles)
        moderation_row = next(row for row in platform_users.data if row['role'] == 'PLATFORM_MODERATION')
        self.assertEqual(moderation_row['platform_role_name'], 'Modérateur dynamique')

        business_users = self.client.get('/api/v1/accounts/admin/users/?scope=business')
        self.assertEqual(business_users.status_code, status.HTTP_200_OK)
        business_roles = {row['role'] for row in business_users.data}
        self.assertIn('BUSINESS_OWNER', business_roles)
        self.assertNotIn('SUPER_ADMIN', business_roles)

        platform_logs = self.client.get('/api/v1/accounts/admin/audit-logs/?scope=platform')
        self.assertEqual(platform_logs.status_code, status.HTTP_200_OK)
        platform_actions = {row['action'] for row in platform_logs.data['results']}
        self.assertIn('PLATFORM_ROLE_UPDATED', platform_actions)
        self.assertIn('BUSINESS_APPROVED', platform_actions)
        self.assertNotIn('TENANT_LOGIN_SUCCESS', platform_actions)
        moderation_log = next(
            row for row in platform_logs.data['results'] if row['user_role'] == 'PLATFORM_MODERATION'
        )
        self.assertEqual(moderation_log['user_role_label'], 'Modérateur dynamique')

        business_logs = self.client.get('/api/v1/accounts/admin/audit-logs/?scope=business')
        self.assertEqual(business_logs.status_code, status.HTTP_200_OK)
        business_actions = {row['action'] for row in business_logs.data['results']}
        self.assertIn('TENANT_LOGIN_SUCCESS', business_actions)
        self.assertNotIn('PLATFORM_ROLE_UPDATED', business_actions)
        owner_log = next(row for row in business_logs.data['results'] if row['user_role'] == 'BUSINESS_OWNER')
        self.assertEqual(owner_log['user_role_label'], 'Admin entreprise')

        # restore
        update_platform_role('moderation', name='Modération')
