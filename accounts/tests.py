from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from accounts.auth_emails import encode_uid, email_verify_token, password_reset_token

User = get_user_model()


class AccountsAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/v1/accounts/register/'
        self.login_url = '/api/v1/accounts/login/'

    def test_register_customer(self):
        response = self.client.post(self.register_url, {
            'email': 'patient@test.bi',
            'password': 'SecurePass123!',
            'first_name': 'Jean',
            'last_name': 'Ndayishimiye',
            'phone_number': '+25779000000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='patient@test.bi').exists())
        user = User.objects.get(email='patient@test.bi')
        self.assertEqual(user.role, 'CUSTOMER')
        self.assertFalse(user.is_email_verified)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Vérifiez', mail.outbox[0].subject)

    def test_login_returns_jwt_and_user(self):
        User.objects.create_user(
            email='login@test.bi',
            password='SecurePass123!',
            first_name='Test',
            role='CUSTOMER',
        )
        response = self.client.post(self.login_url, {
            'email': 'login@test.bi',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertTrue(response.cookies['isoko_access']['httponly'])
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'login@test.bi')

    def test_profile_requires_auth(self):
        response = self.client.get('/api/v1/accounts/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verify_email_with_valid_token(self):
        user = User.objects.create_user(
            email='verify@test.bi', password='SecurePass123!', role='CUSTOMER',
        )
        self.assertFalse(user.is_email_verified)
        uid = encode_uid(user)
        token = email_verify_token.make_token(user)
        response = self.client.post('/api/v1/accounts/verify-email/', {
            'uid': uid, 'token': token,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

    def test_password_reset_flow(self):
        user = User.objects.create_user(
            email='reset@test.bi', password='OldPass123!', role='CUSTOMER',
        )
        req = self.client.post('/api/v1/accounts/password-reset/', {
            'email': 'reset@test.bi',
        }, format='json')
        self.assertEqual(req.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        uid = encode_uid(user)
        token = password_reset_token.make_token(user)
        confirm = self.client.post('/api/v1/accounts/password-reset/confirm/', {
            'uid': uid,
            'token': token,
            'password': 'NewSecurePass123!',
        }, format='json')
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewSecurePass123!'))

        login = self.client.post(self.login_url, {
            'email': 'reset@test.bi',
            'password': 'NewSecurePass123!',
        }, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_register_rejects_existing_email_without_logging_it(self):
        from accounts.models import AuditLog

        User.objects.create_user(
            email='patient@test.bi', password='SecurePass123!', role='CUSTOMER',
        )
        response = self.client.post(self.register_url, {
            'email': 'Patient@test.bi',
            'password': 'SecurePass123!',
            'first_name': 'Jean',
            'last_name': 'Ndayishimiye',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('existe déjà', str(response.data.get('email')))
        failed = AuditLog.objects.filter(action='USER_REGISTER_FAILED').latest('created_at')
        self.assertEqual(failed.user_email, 'ANONYMOUS')
        self.assertNotIn('patient@test.bi', str(failed.details).lower())

    def test_register_returns_specific_password_error(self):
        response = self.client.post(self.register_url, {
            'email': 'short@test.bi',
            'password': 'abc',
            'first_name': 'A',
            'last_name': 'B',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('trop court', str(response.data.get('password')).lower())

    def test_admin_create_can_send_verification_and_refuses_owner_takeover(self):
        from rest_framework import serializers as drf_serializers
        from businesses.models import Business
        from accounts.serializers import AdminUserCreateSerializer

        owner = User.objects.create_user(
            email='owner@test.bi', password='SecurePass123!', role='BUSINESS_OWNER',
        )
        business = Business.objects.create(owner=owner, name='École test')
        takeover = AdminUserCreateSerializer(data={
            'email': 'new-owner@test.bi',
            'password': 'SecurePass123!',
            'role': 'PROFESSIONAL',
            'business_id': str(business.id),
            'business_relationship': 'OWNER',
            'send_verification_email': False,
        })
        self.assertTrue(takeover.is_valid(), takeover.errors)
        with self.assertRaises(drf_serializers.ValidationError):
            takeover.save()
        business.refresh_from_db()
        self.assertEqual(business.owner_id, owner.id)
        self.assertFalse(User.objects.filter(email='new-owner@test.bi').exists())

        created = AdminUserCreateSerializer(data={
            'email': 'staff@test.bi',
            'password': 'SecurePass123!',
            'role': 'PROFESSIONAL',
            'send_verification_email': True,
        })
        self.assertTrue(created.is_valid(), created.errors)
        user = created.save()
        self.assertFalse(user.is_email_verified)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(user.email, mail.outbox[0].to)

    def test_oauth_providers_status_endpoint(self):
        response = self.client.get('/api/v1/accounts/oauth/providers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key in ('google', 'facebook', 'github'):
            self.assertIn(key, response.data)
            self.assertIn('configured', response.data[key])

    def test_login_locks_after_five_failures(self):
        User.objects.create_user(
            email='lock@test.bi', password='SecurePass123!', role='CUSTOMER',
        )
        for _ in range(5):
            denied = self.client.post(self.login_url, {
                'email': 'lock@test.bi',
                'password': 'wrong-password',
            }, format='json')
            self.assertEqual(denied.status_code, status.HTTP_401_UNAUTHORIZED)
        locked = self.client.post(self.login_url, {
            'email': 'lock@test.bi',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(locked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_lock_uses_configured_threshold(self):
        from site_content.models import SiteSettings
        SiteSettings.objects.create(login_max_failures=2, login_lock_minutes=30)
        User.objects.create_user(
            email='lock2@test.bi', password='SecurePass123!', role='CUSTOMER',
        )
        for _ in range(2):
            denied = self.client.post(self.login_url, {
                'email': 'lock2@test.bi',
                'password': 'wrong-password',
            }, format='json')
            self.assertEqual(denied.status_code, status.HTTP_401_UNAUTHORIZED)
        locked = self.client.post(self.login_url, {
            'email': 'lock2@test.bi',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(locked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('30', str(locked.data))


class JwtRefreshBlacklistTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User.objects.create_user(
            email='jwt@test.bi', password='SecurePass123!', role='CUSTOMER',
        )

    def test_rotated_refresh_token_is_blacklisted(self):
        login = self.client.post('/api/v1/accounts/login/', {
            'email': 'jwt@test.bi',
            'password': 'SecurePass123!',
        }, format='json')
        old_refresh = login.cookies['isoko_refresh'].value
        first = self.client.post('/api/v1/accounts/refresh/', {
            'refresh': old_refresh,
        }, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertNotEqual(first.cookies['isoko_refresh'].value, old_refresh)
        # Ancien refresh ne doit plus être réutilisable
        second = self.client.post('/api/v1/accounts/refresh/', {
            'refresh': old_refresh,
        }, format='json')
        self.assertEqual(second.status_code, status.HTTP_401_UNAUTHORIZED)
        # Nettoyage des cookies de session sur refresh invalide
        self.assertIn('isoko_access', second.cookies)
        self.assertIn('isoko_refresh', second.cookies)
        self.assertIn('isoko_session', second.cookies)
        self.assertIn(second.cookies['isoko_access']['max-age'], (0, -1))
        self.assertIn(second.cookies['isoko_refresh']['max-age'], (0, -1))
        self.assertIn(second.cookies['isoko_session']['max-age'], (0, -1))


class SessionHintCookieTests(TestCase):
    """Le cookie `isoko_session` permet au front de ne pas sonder à vide.

    Sans lui, un visiteur non connecté déclenchait /profile/ puis /refresh/ en
    401 à chaque chargement : du bruit console et deux requêtes sur le chemin
    critique du premier rendu.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='hint@test.bi', password='SecurePass123!', role='CUSTOMER',
        )

    def test_login_sets_readable_hint_alongside_httponly_tokens(self):
        response = self.client.post('/api/v1/accounts/login/', {
            'email': 'hint@test.bi',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        hint = response.cookies['isoko_session']
        # Lisible par le JS (c'est le but), mais sans secret dedans.
        self.assertFalse(hint['httponly'])
        self.assertEqual(hint.value, '1')
        # Les jetons, eux, restent protégés.
        self.assertTrue(response.cookies['isoko_access']['httponly'])
        self.assertTrue(response.cookies['isoko_refresh']['httponly'])

    def test_logout_clears_the_hint(self):
        self.client.post('/api/v1/accounts/login/', {
            'email': 'hint@test.bi',
            'password': 'SecurePass123!',
        }, format='json')
        response = self.client.post('/api/v1/accounts/logout/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertIn(response.cookies['isoko_session']['max-age'], (0, -1))

    def test_refresh_keeps_the_hint_alive(self):
        login = self.client.post('/api/v1/accounts/login/', {
            'email': 'hint@test.bi',
            'password': 'SecurePass123!',
        }, format='json')
        response = self.client.post('/api/v1/accounts/refresh/', {
            'refresh': login.cookies['isoko_refresh'].value,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(response.cookies['isoko_session'].value, '1')
        self.assertGreater(response.cookies['isoko_session']['max-age'], 0)

    def test_anonymous_refresh_still_answers_401(self):
        # Le garde est côté front : l'API doit rester ouverte et honnête.
        response = self.client.post('/api/v1/accounts/refresh/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('isoko_session', response.cookies)


class StrictLoginEmailTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        User.objects.create_user(
            email='m@gmail.com', password='SecurePass123!', role='BUSINESS_OWNER',
            first_name='Admin', last_name='Pharma',
        )
        User.objects.create_user(
            email='ma@gmail.com', password='OtherPass123!', role='PROFESSIONAL',
            first_name='Manager', last_name='Hotel',
        )

    def test_emails_are_distinct_users(self):
        from accounts.email_identity import get_user_by_login_email, emails_strictly_equal
        m = get_user_by_login_email('m@gmail.com')
        ma = get_user_by_login_email('ma@gmail.com')
        self.assertIsNotNone(m)
        self.assertIsNotNone(ma)
        self.assertNotEqual(m.pk, ma.pk)
        self.assertFalse(emails_strictly_equal('m@gmail.com', 'ma@gmail.com'))

    def test_login_m_does_not_authenticate_ma(self):
        # Bon email m@ + mauvais mdp de ma@ → échec
        bad = self.client.post('/api/v1/accounts/login/', {
            'email': 'm@gmail.com',
            'password': 'OtherPass123!',
        }, format='json')
        self.assertEqual(bad.status_code, status.HTTP_401_UNAUTHORIZED)

        ok = self.client.post('/api/v1/accounts/login/', {
            'email': 'm@gmail.com',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(ok.data['user']['email'], 'm@gmail.com')
        self.assertEqual(ok.data['user']['role'], 'BUSINESS_OWNER')

        ok_ma = self.client.post('/api/v1/accounts/login/', {
            'email': 'ma@gmail.com',
            'password': 'OtherPass123!',
        }, format='json')
        self.assertEqual(ok_ma.status_code, status.HTTP_200_OK)
        self.assertEqual(ok_ma.data['user']['email'], 'ma@gmail.com')
        self.assertEqual(ok_ma.data['user']['role'], 'PROFESSIONAL')
