from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business, BusinessSubscription
from businesses.subscription import ensure_business_subscription, get_or_create_default_plans
from businesses.tenant import filter_queryset_by_hospital_tenant, get_user_tenant_business
from hospital.models import Appointment, DoctorProfile, Specialty

User = get_user_model()


class TenantIsolationTests(TestCase):
    def setUp(self):
        self.category = BusinessCategory.objects.create(name='Hôpital', slug='hopital-tenant')
        self.owner_a = User.objects.create_user(
            email='owner-a@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.owner_b = User.objects.create_user(
            email='owner-b@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.hospital_a = Business.objects.create(
            owner=self.owner_a, primary_category=self.category, name='Hôpital A',
            province='Bujumbura Mairie',
        )
        self.hospital_b = Business.objects.create(
            owner=self.owner_b, primary_category=self.category, name='Hôpital B',
            province='Gitega',
        )
        specialty = Specialty.objects.create(name='Générale')
        patient = User.objects.create_user(
            email='patient-tenant@test.bi', password='Pass123456!', role='CUSTOMER',
        )
        doc_a = User.objects.create_user(
            email='doc-a@test.bi', password='Pass123456!', role='PROFESSIONAL',
        )
        doctor_a = DoctorProfile.objects.create(
            user=doc_a, hospital=self.hospital_a,
            medical_license_number='LIC-A', staff_category='DOCTOR',
        )
        doctor_a.specialties.add(specialty)
        doc_b = User.objects.create_user(
            email='doc-b@test.bi', password='Pass123456!', role='PROFESSIONAL',
        )
        doctor_b = DoctorProfile.objects.create(
            user=doc_b, hospital=self.hospital_b,
            medical_license_number='LIC-B', staff_category='DOCTOR',
        )
        doctor_b.specialties.add(specialty)

        when = timezone.now() + timedelta(days=1)
        Appointment.objects.create(
            hospital=self.hospital_a, doctor=doctor_a, patient=patient,
            patient_contact_name='Patient A', patient_contact_phone='79000001',
            appointment_date=when, reason='A', status='PENDING',
            reference_code='TENANT-A-001',
        )
        Appointment.objects.create(
            hospital=self.hospital_b, doctor=doctor_b, patient=patient,
            patient_contact_name='Patient B', patient_contact_phone='79000002',
            appointment_date=when, reason='B', status='PENDING',
            reference_code='TENANT-B-001',
        )

    def test_owner_sees_only_own_tenant(self):
        self.assertEqual(get_user_tenant_business(self.owner_a).id, self.hospital_a.id)
        qs = filter_queryset_by_hospital_tenant(self.owner_a, Appointment.objects.all())
        self.assertEqual(qs.count(), 1)
        self.assertEqual(qs.first().hospital_id, self.hospital_a.id)

    def test_super_admin_has_no_hospital_tenant_queryset(self):
        admin = User.objects.create_user(
            email='admin@test.bi', password='Pass123456!', role='SUPER_ADMIN',
        )
        qs = filter_queryset_by_hospital_tenant(admin, Appointment.objects.all())
        self.assertEqual(qs.count(), 0)


class SubscriptionGateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        get_or_create_default_plans()
        self.category = BusinessCategory.objects.create(name='Commerce', slug='commerce-sub')
        self.owner = User.objects.create_user(
            email='sub-owner@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.business = Business.objects.create(
            owner=self.owner, primary_category=self.category, name='Shop Sub',
            province='Bujumbura Mairie',
        )
        ensure_business_subscription(self.business)
        login = self.client.post('/api/v1/accounts/login/', {
            'email': 'sub-owner@test.bi', 'password': 'Pass123456!',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_write_blocked_when_subscription_expired(self):
        from businesses.subscription import update_grace_period_days
        update_grace_period_days(7)
        sub = self.business.subscription
        sub.status = 'EXPIRED'
        sub.ends_at = timezone.now() - timedelta(days=10)
        sub.save(update_fields=['status', 'ends_at', 'updated_at'])

        response = self.client.patch(
            '/api/v1/businesses/me/',
            {'description': 'should be blocked'},
            format='json',
        )
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.json().get('code'), 'subscription_required')

    def test_write_allowed_during_grace_period(self):
        from businesses.models import PlatformNotification
        from businesses.subscription import update_grace_period_days
        from hospital.models import Notification

        update_grace_period_days(7)
        sub = self.business.subscription
        sub.status = 'ACTIVE'
        sub.ends_at = timezone.now() - timedelta(days=2)
        sub.save(update_fields=['status', 'ends_at', 'updated_at'])

        response = self.client.patch(
            '/api/v1/businesses/me/',
            {'description': 'still open in grace'},
            format='json',
        )
        self.assertNotEqual(response.status_code, 402)
        sub.refresh_from_db()
        self.assertEqual(sub.status, 'GRACE')
        self.assertGreaterEqual(sub.grace_notice_ends_at, sub.ends_at)
        self.assertTrue(PlatformNotification.objects.filter(notification_type='SUBSCRIPTION_GRACE', business=self.business).exists())
        self.assertTrue(Notification.objects.filter(user=self.owner, title__startswith='Période de grâce').exists())

    def test_write_allowed_with_active_subscription(self):
        response = self.client.patch(
            '/api/v1/businesses/me/',
            {'description': 'ok'},
            format='json',
        )
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))
        self.assertNotEqual(response.status_code, 402)


class MyBusinessSelectionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = BusinessCategory.objects.create(name='Multi', slug='multi-biz')
        self.owner = User.objects.create_user(
            email='multi@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.b1 = Business.objects.create(
            owner=self.owner, primary_category=self.category, name='Biz One',
            province='Bujumbura Mairie', description='one',
        )
        self.b2 = Business.objects.create(
            owner=self.owner, primary_category=self.category, name='Biz Two',
            province='Gitega', description='two',
        )
        ensure_business_subscription(self.b1)
        ensure_business_subscription(self.b2)
        login = self.client.post('/api/v1/accounts/login/', {
            'email': 'multi@test.bi', 'password': 'Pass123456!',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_patch_targets_business_via_query_param(self):
        response = self.client.patch(
            f'/api/v1/businesses/me/?business={self.b2.id}',
            {'description': 'updated-two'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.b2.refresh_from_db()
        self.b1.refresh_from_db()
        self.assertEqual(self.b2.description, 'updated-two')
        self.assertEqual(self.b1.description, 'one')


class SubscriptionGraceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = BusinessCategory.objects.create(name='Shop', slug='shop-grace')
        self.owner = User.objects.create_user(
            email='grace-owner@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.admin = User.objects.create_user(
            email='grace-admin@test.bi', password='Pass123456!', role='SUPER_ADMIN',
        )
        self.business = Business.objects.create(
            owner=self.owner, primary_category=self.category, name='Grace Shop',
            province='Bujumbura Mairie',
        )
        ensure_business_subscription(self.business)

    def test_warns_five_days_before_expiry(self):
        from businesses.models import PlatformNotification
        from businesses.subscription import subscription_summary, update_grace_period_days
        from hospital.models import Notification

        update_grace_period_days(5)
        sub = self.business.subscription
        sub.ends_at = timezone.now() + timedelta(days=4)
        sub.status = 'ACTIVE'
        sub.save(update_fields=['status', 'ends_at', 'updated_at'])

        summary = subscription_summary(self.business)
        self.assertTrue(summary['expiry_warning'])
        self.assertFalse(summary['in_grace'])
        self.assertTrue(PlatformNotification.objects.filter(
            notification_type='SUBSCRIPTION_EXPIRING', business=self.business,
        ).exists())
        self.assertTrue(Notification.objects.filter(user=self.owner, title__startswith='Abonnement bientôt expiré').exists())
        subscription_summary(self.business)
        self.assertEqual(
            PlatformNotification.objects.filter(notification_type='SUBSCRIPTION_EXPIRING', business=self.business).count(),
            1,
        )

    def test_super_admin_sets_grace_for_every_business(self):
        login = self.client.post('/api/v1/accounts/login/', {
            'email': 'grace-admin@test.bi', 'password': 'Pass123456!',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.patch(
            '/api/v1/businesses/admin/subscription-settings/',
            {'grace_period_days': 12},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['grace_period_days'], 12)
        self.assertEqual(response.json()['warning_days'], 5)

