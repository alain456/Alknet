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
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
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

    def test_oauth_providers_status_endpoint(self):
        response = self.client.get('/api/v1/accounts/oauth/providers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key in ('google', 'facebook', 'github'):
            self.assertIn(key, response.data)
            self.assertIn('configured', response.data[key])


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
        old_refresh = login.data['refresh']
        first = self.client.post('/api/v1/accounts/refresh/', {
            'refresh': old_refresh,
        }, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertIn('refresh', first.data)
        # Ancien refresh ne doit plus être réutilisable
        second = self.client.post('/api/v1/accounts/refresh/', {
            'refresh': old_refresh,
        }, format='json')
        self.assertEqual(second.status_code, status.HTTP_401_UNAUTHORIZED)
