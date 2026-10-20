from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business
from businesses.registration_mail import render_registration_message
from django.contrib.auth import get_user_model

User = get_user_model()


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class BusinessRegistrationMailTests(TestCase):
    def setUp(self):
        self.category = BusinessCategory.objects.create(name='Boutique', slug='boutique-mail')
        self.owner = User.objects.create_user(
            email='owner-mail@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
            first_name='Aline', last_name='Ndayishimiye',
        )
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            name='Boutique Aline',
            email='boutique-aline@test.bi',
            verification_status='PENDING',
            is_verified=False,
            is_active=False,
        )
        self.admin = User.objects.create_superuser(
            email='admin-mail@test.bi', password='Pass123456!',
        )

    def test_received_template_names_the_business(self):
        subject, body = render_registration_message('received', self.business)
        self.assertIn('Boutique Aline', subject)
        self.assertIn('bien reçu', body)
        self.assertIn('Aline Ndayishimiye', body)
        self.assertIn('Boutique', body)

    def test_approval_sends_the_template(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post(
            f'/api/v1/businesses/admin/moderation/{self.business.id}/approve/',
            {'message': 'Bienvenue dans l’annuaire.'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('approuvée', mail.outbox[0].subject)
        self.assertIn('Bienvenue dans l’annuaire.', mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, ['boutique-aline@test.bi'])

    def test_rejection_requires_a_reason_and_sends_it(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        missing = client.post(
            f'/api/v1/businesses/admin/moderation/{self.business.id}/reject/',
            {},
            format='json',
        )
        self.assertEqual(missing.status_code, 400)
        response = client.post(
            f'/api/v1/businesses/admin/moderation/{self.business.id}/reject/',
            {'reason': 'Document illisible.'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn('Document illisible.', mail.outbox[0].body)
