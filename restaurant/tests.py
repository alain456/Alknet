from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory, ModuleKey
from businesses.models import Business
from hotel.models import HotelProfile

User = get_user_model()


class RestaurantModuleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.root = BusinessCategory.objects.create(
            name='Hôtellerie et tourisme',
            slug='hotellerie-et-tourisme-resto-test',
            module=ModuleKey.HOTEL,
        )
        self.resto_cat = BusinessCategory.objects.create(
            name='Restaurant',
            slug='restaurant-module-test',
            parent=self.root,
            module=ModuleKey.RESTAURANT,
        )
        self.hotel_cat = BusinessCategory.objects.create(
            name='Hôtel',
            slug='hotel-module-test',
            parent=self.root,
            module=ModuleKey.HOTEL,
        )
        self.owner = User.objects.create_user(
            email='resto-owner@test.bi', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel_owner = User.objects.create_user(
            email='hotel-owner-resto@test.bi', password='pass', role='BUSINESS_OWNER',
        )
        self.resto = Business.objects.create(
            owner=self.owner,
            primary_category=self.resto_cat,
            category=self.resto_cat,
            name='Chez Aline Grill',
            email='aline@test.bi',
            is_active=True,
            is_verified=True,
            verification_status='APPROVED',
            commune='Mukaza',
            province='Bujumbura Mairie',
        )
        self.hotel = Business.objects.create(
            owner=self.hotel_owner,
            primary_category=self.hotel_cat,
            category=self.hotel_cat,
            name='Hôtel du Lac',
            email='lac@test.bi',
            is_active=True,
            is_verified=True,
            verification_status='APPROVED',
        )
        HotelProfile.objects.create(business=self.hotel, trade_name='Hôtel du Lac', status='ACTIVE')

    def test_food_child_without_module_becomes_restaurant(self):
        child = BusinessCategory.objects.create(
            name='Café', slug='cafe-inherit-test', parent=self.root,
        )
        self.assertEqual(child.module, ModuleKey.RESTAURANT)

    def test_public_directory_lists_restaurants_not_hotels(self):
        listing = self.client.get('/api/v1/restaurant/public/venues/')
        self.assertEqual(listing.status_code, 200, listing.content)
        names = [row['name'] for row in listing.data]
        self.assertIn('Chez Aline Grill', names)
        self.assertNotIn('Hôtel du Lac', names)

        hidden = self.client.get(f'/api/v1/hotel/public/hotels/{self.resto.id}/')
        self.assertEqual(hidden.status_code, 404)
        hotels = self.client.get('/api/v1/hotel/public/hotels/')
        self.assertEqual(hotels.status_code, 200)
        hotel_names = [row['name'] for row in hotels.data]
        self.assertNotIn('Chez Aline Grill', hotel_names)

    def test_restaurant_owner_cannot_open_hotel_pms(self):
        self.client.force_authenticate(self.owner)
        denied = self.client.get('/api/v1/hotel/profile/me/')
        self.assertEqual(denied.status_code, 403)

    def test_manager_profile_menu_and_table_booking(self):
        self.client.force_authenticate(self.owner)
        me = self.client.get('/api/v1/restaurant/profile/me/')
        self.assertEqual(me.status_code, 200, me.content)
        self.assertEqual(me.data['venue_kind'], 'RESTAURANT')

        patched = self.client.patch(
            '/api/v1/restaurant/profile/me/',
            {'cuisine_type': 'Grillades', 'seats': 40, 'reservations_open': True},
            format='json',
        )
        self.assertEqual(patched.status_code, 200, patched.content)
        self.assertEqual(patched.data['cuisine_type'], 'Grillades')

        created = self.client.post(
            '/api/v1/restaurant/menu/',
            {
                'name': 'Brochettes',
                'section': 'plats',
                'price': '12000',
                'is_available': True,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        public = self.client.get(f'/api/v1/restaurant/public/venues/{self.resto.id}/')
        self.assertEqual(public.status_code, 200, public.content)
        self.assertEqual(public.data['cuisine_type'], 'Grillades')
        self.assertEqual(len(public.data['menu']), 1)
        self.assertEqual(public.data['menu'][0]['name'], 'Brochettes')

        guest = APIClient()
        booked_for = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        book = guest.post(
            f'/api/v1/restaurant/public/venues/{self.resto.id}/book/',
            {
                'guest_name': 'Jean Client',
                'guest_phone': '71234567',
                'guest_email': 'jean@test.bi',
                'party_size': 4,
                'booked_for': booked_for.isoformat(),
                'notes': 'Terrasse',
            },
            format='json',
        )
        self.assertEqual(book.status_code, 201, book.content)
        booking_id = book.data['id']
        self.assertEqual(book.data['status'], 'PENDING')

        dash = self.client.get('/api/v1/restaurant/dashboard/')
        self.assertEqual(dash.status_code, 200, dash.content)
        self.assertEqual(dash.data['pending_bookings'], 1)

        confirm = self.client.post(
            f'/api/v1/restaurant/bookings/{booking_id}/confirm/',
            {},
            format='json',
        )
        self.assertEqual(confirm.status_code, 200, confirm.content)
        self.assertEqual(confirm.data['status'], 'CONFIRMED')

    def test_hotel_owner_cannot_open_restaurant_space(self):
        self.client.force_authenticate(self.hotel_owner)
        denied = self.client.get('/api/v1/restaurant/profile/me/')
        self.assertEqual(denied.status_code, 403)
