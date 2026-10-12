"""Non-régression P0 : autorisation des paiements invités, isolation tenant,
fermeture des référentiels en écriture et suppression des réinitialisations
de mot de passe.

Lancement ciblé :
    ./venv/bin/python manage.py test test_p0_security
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business, BusinessEmployee, BusinessRole
from hospital.models import DoctorProfile, HospitalProfile, MedicalService, Specialty
from locations.models import Commune, Province
from orders.models import Order
from retail.models import RetailOrder
from wholesale.models import WholesaleOrder


User = get_user_model()


def make_user(email, role='CUSTOMER', password='Pass123456!'):
    return User.objects.create_user(email=email, password=password, role=role)


def make_business(owner, category, name):
    return Business.objects.create(
        owner=owner,
        primary_category=category,
        category=category,
        name=name,
        email=f'{name.lower().replace(" ", "")}@test.bi',
    )


class PaymentTokenIsolationTests(TestCase):
    """Un UUID de commande ne doit jamais autoriser un paiement."""

    def setUp(self):
        self.client = APIClient()
        self.category = BusinessCategory.objects.create(name='Commerce', slug='commerce')
        self.owner = make_user('owner@pay.test', 'BUSINESS_OWNER')
        self.stranger = make_user('stranger@pay.test')
        self.business = make_business(self.owner, self.category, 'Boutique Test')

        self.order = Order.objects.create(
            business=self.business,
            customer=self.stranger,
            reference_code='CMD-TEST-1',
            payment_method='BURUNDIPAY',
        )
        self.retail_order = RetailOrder.objects.create(
            retail_business=self.business,
            patient_name='Guest',
            patient_email='guest@pay.test',
            reference='CMD-PD-TEST',
            payment_method='BURUNDIPAY',
        )
        self.wholesale_order = WholesaleOrder.objects.create(
            wholesale_business=self.business,
            client_business=self.business,
            reference='CMD-GT-TEST',
            payment_method='BURUNDIPAY',
        )

    def assert_anonymous_is_rejected(self, url, body=None):
        for token in (None, str(self.order.payment_token)):
            client = APIClient()
            if token:
                client.credentials(**{'HTTP_X_PAYMENT_TOKEN': token})
            response = client.post(url, body or {}, format='json')
            self.assertEqual(response.status_code, 404, response.content)
            # l'ordre ne doit pas avoir bougé
            return response

    def test_orders_pay_requires_ownership_or_token(self):
        self.assert_anonymous_is_rejected(
            f'/api/v1/orders/{self.order.id}/pay/',
            {'payer_phone': '79123456'},
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'UNPAID')

    def test_orders_confirm_requires_ownership_or_token(self):
        self.assert_anonymous_is_rejected(f'/api/v1/orders/{self.order.id}/confirm-payment/')
        self.order.refresh_from_db()
        self.assertNotEqual(self.order.payment_status, 'PAID')

    def test_orders_retrieve_by_id_requires_auth(self):
        response = APIClient().get(f'/api/v1/orders/{self.order.id}/')
        self.assertIn(response.status_code, (401, 404))

    def test_orders_retrieve_does_not_leak_order_list(self):
        response = APIClient().get('/api/v1/orders/')
        self.assertIn(response.status_code, (401, 404))

    def test_valid_payment_token_grants_access(self):
        client = APIClient()
        client.credentials(**{'HTTP_X_PAYMENT_TOKEN': str(self.order.payment_token)})
        response = client.post(
            f'/api/v1/orders/{self.order.id}/pay/', {'payer_phone': '79123456'}, format='json'
        )
        self.assertNotEqual(response.status_code, 404, response.content)

    def test_owner_can_pay_without_token(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.post(
            f'/api/v1/orders/{self.order.id}/pay/', {'payer_phone': '79123456'}, format='json'
        )
        self.assertNotEqual(response.status_code, 404, response.content)

    def test_other_tenant_staff_cannot_pay(self):
        outsider = make_user('staff@pay.test')
        other_owner = make_user('other@pay.test', 'BUSINESS_OWNER')
        other_business = make_business(other_owner, self.category, 'Boutique Vole')
        BusinessEmployee.objects.create(
            user=outsider, business=other_business,
            role=BusinessRole.objects.create(business=other_business, name='Vendeur'),
        )
        client = APIClient()
        client.force_authenticate(outsider)
        response = client.post(
            f'/api/v1/orders/{self.order.id}/pay/', {'payer_phone': '79123456'}, format='json'
        )
        self.assertEqual(response.status_code, 404, response.content)

    def test_retail_pay_rejects_anonymous_even_with_foreign_token(self):
        client = APIClient()
        client.credentials(**{'HTTP_X_PAYMENT_TOKEN': str(self.order.payment_token)})
        response = client.post(
            f'/api/v1/retail/orders/{self.retail_order.id}/pay/',
            {'payer_phone': '79123456'},
            format='json',
        )
        self.assertEqual(response.status_code, 404, response.content)

    def test_wholesale_pay_rejects_anonymous_even_with_foreign_token(self):
        client = APIClient()
        client.credentials(**{'HTTP_X_PAYMENT_TOKEN': str(self.order.payment_token)})
        response = client.post(
            f'/api/v1/wholesale/orders/{self.wholesale_order.id}/pay/',
            {'payer_phone': '79123456'},
            format='json',
        )
        self.assertEqual(response.status_code, 404, response.content)

    def test_payment_token_is_unique_per_order(self):
        other = Order.objects.create(
            business=self.business, customer=self.stranger, reference_code='CMD-TEST-2'
        )
        self.assertNotEqual(self.order.payment_token, other.payment_token)
        self.assertTrue(self.order.payment_token)


class AdminImportAndPasswordTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = BusinessCategory.objects.create(name='Commerce', slug='commerce')
        self.owner = make_user('owner@admin.test', 'BUSINESS_OWNER')
        self.employee = make_user('employee@admin.test')
        self.tenant = make_business(self.owner, self.category, 'Societe Test')
        self.role = BusinessRole.objects.create(business=self.tenant, name='Gérant')

    def _items(self, email='import@admin.test', name='Import Test'):
        return {
            'items': [{
                'name': name,
                'email': email,
                'sector': self.category.name,
                'province': 'Bujumbura Mairie',
                'commune': 'Mukaza',
            }]
        }

    def _post_import(self, client, email='import@admin.test'):
        return client.post(
            '/api/v1/businesses/admin/import-csv/',
            self._items(email=email),
            format='json',
        )

    def test_anonymous_cannot_import(self):
        self.assertIn(self._post_import(APIClient()).status_code, (401, 403))
        self.assertFalse(User.objects.filter(email='import@admin.test').exists())

    def test_tenant_owner_cannot_import(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        self.assertIn(self._post_import(client).status_code, (401, 403))
        self.assertFalse(User.objects.filter(email='import@admin.test').exists())

    def test_platform_admin_can_import_and_user_has_no_usable_password(self):
        admin = make_user('super@admin.test', 'SUPER_ADMIN', password='Pass123456!')
        client = APIClient()
        client.force_authenticate(admin)
        response = self._post_import(client)
        self.assertEqual(response.status_code, 200, response.content)
        created = User.objects.filter(email='import@admin.test').first()
        self.assertIsNotNone(created)
        self.assertFalse(created.has_usable_password())
        self.assertEqual(created.role, 'BUSINESS_OWNER')
        self.assertTrue(
            Business.objects.filter(owner=created, is_verified=True).exists()
        )

    def test_existing_account_cannot_be_attached_with_a_password(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.post(
            '/api/v1/businesses/my-business/employees/',
            {'email': self.employee.email, 'password': 'Hijack123!', 'role': 'Gérant'},
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(
            BusinessEmployee.objects.filter(user=self.employee).exists()
        )

    def test_existing_account_password_cannot_be_reset_by_other_tenant(self):
        other_owner = make_user('other@admin.test', 'BUSINESS_OWNER')
        other_business = make_business(other_owner, self.category, 'Autre Societe')
        other_role = BusinessRole.objects.create(business=other_business, name='Gérant')
        membership = BusinessEmployee.objects.create(
            user=self.owner, business=other_business, role=other_role
        )
        client = APIClient()
        client.force_authenticate(self.owner)
        # le lien appartient à un autre tenant : invisible depuis my-business
        response = client.patch(
            f'/api/v1/businesses/my-business/employees/{membership.id}/',
            {'password': 'Hijack123!'},
            format='json',
        )
        self.assertIn(response.status_code, (403, 404), response.content)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password('Pass123456!'))


class HospitalTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = BusinessCategory.objects.create(name='Hôpital', slug='hopital')
        self.owner_a = make_user('owner-a@hop.test', 'BUSINESS_OWNER')
        self.owner_b = make_user('owner-b@hop.test', 'BUSINESS_OWNER')
        self.hospital_a = make_business(self.owner_a, self.category, 'Hopital A')
        self.hospital_b = make_business(self.owner_b, self.category, 'Hopital B')

        self.specialty = Specialty.objects.create(name='Cardiologie')
        self.doctor_a = DoctorProfile.objects.create(
            user=make_user('doc-a@hop.test', 'PROFESSIONAL'),
            hospital=self.hospital_a,
            medical_license_number='LIC-A',
            staff_category='DOCTOR',
        )
        self.doctor_a.specialties.add(self.specialty)
        self.doctor_b = DoctorProfile.objects.create(
            user=make_user('doc-b@hop.test', 'PROFESSIONAL'),
            hospital=self.hospital_b,
            medical_license_number='LIC-B',
            staff_category='DOCTOR',
        )
        self.service_b = MedicalService.objects.create(
            hospital=self.hospital_b, name='Scanner B', indicative_cost='50000'
        )
        self.profile_a = HospitalProfile.objects.create(business=self.hospital_a)
        self.profile_b = HospitalProfile.objects.create(business=self.hospital_b)

    def test_cannot_create_doctor_in_foreign_hospital(self):
        client = APIClient()
        client.force_authenticate(self.owner_a)
        response = client.post(
            '/api/v1/hospital/doctors/',
            {
                'user': str(self.doctor_a.user_id),
                'hospital': str(self.hospital_b.id),
                'medical_license_number': 'LIC-X',
                'staff_category': 'DOCTOR',
            },
            format='json',
        )
        self.assertIn(response.status_code, (400, 403), response.content)

    def test_cannot_update_foreign_doctor(self):
        client = APIClient()
        client.force_authenticate(self.owner_a)
        response = client.patch(
            f'/api/v1/hospital/doctors/{self.doctor_b.id}/',
            {'consultation_fee': '1'},
            format='json',
        )
        self.assertIn(response.status_code, (403, 404), response.content)

    def test_cannot_delete_foreign_hospital_profile(self):
        client = APIClient()
        client.force_authenticate(self.owner_a)
        response = client.delete(
            f'/api/v1/hospital/profiles/{self.profile_b.id}/'
        )
        self.assertIn(response.status_code, (403, 404), response.content)
        self.assertTrue(HospitalProfile.objects.filter(id=self.profile_b.id).exists())

    def test_cannot_create_service_in_foreign_hospital(self):
        client = APIClient()
        client.force_authenticate(self.owner_a)
        response = client.post(
            '/api/v1/hospital/services/',
            {'hospital': str(self.hospital_b.id), 'name': 'Service injecte',
             'indicative_cost': '1000'},
            format='json',
        )
        self.assertIn(response.status_code, (400, 403), response.content)
        self.assertFalse(
            MedicalService.objects.filter(name='Service injecte').exists()
        )

    def test_cannot_assign_own_doctor_foreign_service(self):
        client = APIClient()
        client.force_authenticate(self.owner_a)
        response = client.post(
            f'/api/v1/hospital/doctors/{self.doctor_a.id}/assign_services/',
            {'service_ids': [str(self.service_b.id)]},
            format='json',
        )
        self.assertIn(response.status_code, (400, 403), response.content)
        self.doctor_a.refresh_from_db()
        self.assertEqual(self.doctor_a.services.count(), 0)

    def test_anonymous_cannot_write_hospital_objects(self):
        client = APIClient()
        response = client.post(
            '/api/v1/hospital/services/',
            {'hospital': str(self.hospital_a.id), 'name': 'Anon',
             'indicative_cost': '1000'},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403), response.content)

    def test_tenant_can_still_manage_own_objects(self):
        client = APIClient()
        client.force_authenticate(self.owner_a)
        response = client.post(
            '/api/v1/hospital/services/',
            {'hospital': str(self.hospital_a.id), 'name': 'Echo A',
             'indicative_cost': '25000'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)


class CatalogWriteClosedTests(TestCase):
    """business_categories et locations : lecture publique, écriture plateforme."""

    def setUp(self):
        self.client = APIClient()
        self.category = BusinessCategory.objects.create(name='Commerce', slug='commerce')
        self.province = Province.objects.create(name='Bujumbura Mairie', code='BJM')
        self.commune = Commune.objects.create(province=self.province, name='Mukaza')

    def test_categories_list_stays_public(self):
        self.assertEqual(APIClient().get('/api/v1/business-categories/').status_code, 200)

    def test_category_create_rejects_anonymous(self):
        response = APIClient().post(
            '/api/v1/business-categories/create/',
            {'name': 'Raquette', 'slug': 'raquette'},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(BusinessCategory.objects.filter(name='Raquette').exists())

    def test_category_create_rejects_tenant_user(self):
        client = APIClient()
        client.force_authenticate(make_user('owner@cat.test', 'BUSINESS_OWNER'))
        response = client.post(
            '/api/v1/business-categories/create/',
            {'name': 'Raquette', 'slug': 'raquette'},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(BusinessCategory.objects.filter(name='Raquette').exists())

    def test_category_detail_rejects_anonymous_delete(self):
        response = APIClient().delete(f'/api/v1/business-categories/{self.category.id}/')
        self.assertIn(response.status_code, (401, 403))
        self.assertTrue(BusinessCategory.objects.filter(id=self.category.id).exists())

    def test_category_platform_admin_can_write(self):
        admin = make_user('super@cat.test', 'SUPER_ADMIN')
        client = APIClient()
        client.force_authenticate(admin)
        response = client.post(
            '/api/v1/business-categories/create/',
            {'name': 'Raquette', 'slug': 'raquette'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)

    def test_locations_tree_stays_public(self):
        self.assertEqual(APIClient().get('/api/v1/locations/tree/').status_code, 200)

    def test_location_create_rejects_anonymous(self):
        response = APIClient().post(
            '/api/v1/locations/provinces/', {'name': 'Pirate', 'code': 'PIR'}, format='json'
        )
        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(Province.objects.filter(name='Pirate').exists())

    def test_location_detail_rejects_anonymous_update(self):
        response = APIClient().patch(
            f'/api/v1/locations/communes/{self.commune.id}/', {'name': 'Detruite'}, format='json'
        )
        self.assertIn(response.status_code, (401, 403))
        self.commune.refresh_from_db()
        self.assertEqual(self.commune.name, 'Mukaza')

    def test_location_seed_rejects_anonymous(self):
        self.assertIn(
            APIClient().post('/api/v1/locations/seed/', {}, format='json').status_code,
            (401, 403),
        )

    def test_location_seed_allows_platform_admin(self):
        admin = make_user('super@loc.test', 'SUPER_ADMIN')
        client = APIClient()
        client.force_authenticate(admin)
        response = client.post('/api/v1/locations/seed/', {}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(Province.objects.filter(name='Gitega').exists())


@override_settings(DEBUG=False)
class ProductionSettingsFailClosedTests(TestCase):
    """Le serveur ne doit pas démarrer en prod avec un secret dev ou des hôtes larges."""

    def test_debug_defaults_to_false_in_production_config(self):
        from django.conf import settings

        self.assertFalse(settings.DEBUG)
        self.assertNotIn('*', settings.ALLOWED_HOSTS)

    def test_orders_confirm_is_blocked_when_stub_disabled(self):
        from businesses import burundipay

        with override_settings(BURUNDIPAY_STUB=False, DEBUG=False):
            self.assertFalse(burundipay.is_stub_mode())
        # une chaîne « 0 » ne doit pas réactiver le stub (bool('0') == True)
        with override_settings(BURUNDIPAY_STUB='0', DEBUG=False):
            self.assertFalse(burundipay.is_stub_mode())
