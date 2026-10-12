from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from services.models import Service

User = get_user_model()


class ServiceReviewTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='svc-owner@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.client_user = User.objects.create_user(
            email='svc-client@test.bi', password='Pass123456!', role='CUSTOMER',
        )
        self.service = Service.objects.create(
            professional=self.owner, title='Peinture', description='Peinture maison',
            status='ACTIVE', price=10000,
        )
        self.api = APIClient()

    def test_review_updates_average_and_count(self):
        self.api.force_authenticate(user=self.client_user)
        first = self.api.post(f'/api/v1/services/{self.service.id}/reviews/', {'score': 4}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.service.refresh_from_db()
        self.assertEqual(self.service.reviews_count, 1)
        self.assertEqual(float(self.service.rating), 4.0)

        again = self.api.post(f'/api/v1/services/{self.service.id}/reviews/', {'score': 2}, format='json')
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.service.refresh_from_db()
        self.assertEqual(self.service.reviews_count, 1)
        self.assertEqual(float(self.service.rating), 2.0)

    def test_owner_cannot_review_own_service(self):
        self.api.force_authenticate(user=self.owner)
        denied = self.api.post(f'/api/v1/services/{self.service.id}/reviews/', {'score': 5}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST)
