"""Circuit opérationnel : check-out → gouvernante → agent → inspection → Prête
(+ signalement → maintenance → retour ménage)."""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory
from businesses.models import Business, BusinessEmployee, BusinessRole
from hotel.models import Guest, HotelProfile, HousekeepingTask, MaintenanceTicket, Reservation, Room, RoomType
from hotel.role_defaults import HOTEL_DEFAULT_ROLES
from hotel.services import check_in_reservation, check_out_stay, record_payment

User = get_user_model()


def _role_perms(name):
    for spec in HOTEL_DEFAULT_ROLES:
        if spec['name'] == name:
            return list(spec['permissions']), spec['system_access_level']
    raise KeyError(name)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class HotelHousekeepingCircuitTests(TestCase):
    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-hk-circuit')
        self.owner = User.objects.create_user(
            email='owner@hotel.test', password='pass', role='BUSINESS_OWNER',
            first_name='Owner',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel Circuit',
            email='hotel@test.bi',
        )
        HotelProfile.objects.get_or_create(business=self.hotel, defaults={'trade_name': 'Hôtel Circuit'})

        self.gouvernante = self._staff('gov@hotel.test', 'Gouvernante', 'Gouvernante')
        self.agent = self._staff('agent@hotel.test', 'Agent de ménage', 'Agent ménage')
        self.maint = self._staff('maint@hotel.test', 'Maintenance', 'Technicien')
        self.reception = self._staff('front@hotel.test', 'Réceptionniste', 'Réception')

        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Standard', base_price=Decimal('50000'),
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            room_type=self.room_type,
            number='101',
            operational_status='AVAILABLE',
            housekeeping_status='READY',
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel, first_name='Client', last_name='Test', email='guest@test.bi',
        )

        self.client = APIClient()

    def _staff(self, email, role_name, position):
        user = User.objects.create_user(
            email=email, password='pass', role='CUSTOMER', first_name=role_name.split()[0],
        )
        perms, level = _role_perms(role_name)
        role = BusinessRole.objects.create(
            business=self.hotel,
            name=role_name,
            system_access_level=level,
            permissions=perms,
        )
        BusinessEmployee.objects.create(
            user=user, business=self.hotel, role=role, position=position, is_active=True,
        )
        return user

    def _in_house_stay(self):
        today = date.today()
        res = Reservation.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            check_in_date=today,
            check_out_date=today + timedelta(days=1),
            adults=1,
            amount_per_night=Decimal('50000'),
            total_amount=Decimal('50000'),
            status='CONFIRMED',
            payment_status='PAID',
            reference=f'RES-TEST-{User.objects.count():06d}',
        )
        stay = check_in_reservation(res, self.room, self.reception)
        # Solde à 0 avant check-out (comme en caisse)
        record_payment(stay.folio, stay.folio.balance, 'CASH', self.reception)
        stay.folio.refresh_from_db()
        return stay

    def test_full_circuit_checkout_to_ready(self):
        stay = self._in_house_stay()
        mail.outbox.clear()

        inv = check_out_stay(stay, self.reception)
        self.room.refresh_from_db()
        task = HousekeepingTask.objects.filter(hotel=self.hotel, room=self.room).latest('created_at')

        self.assertEqual(self.room.operational_status, 'CLEANING')
        self.assertEqual(self.room.housekeeping_status, 'CLEANING_REQUIRED')
        self.assertEqual(task.status, 'PENDING')
        self.assertEqual(task.priority, 'HIGH')
        self.assertTrue(hasattr(inv, '_hk_notification'))
        self.assertTrue(inv._hk_notification.get('ok') or inv._hk_notification.get('in_app'))
        # Email gouvernante
        gov_mails = [m for m in mail.outbox if self.gouvernante.email in m.to]
        self.assertTrue(gov_mails, 'La gouvernante doit recevoir un email CLEANING_REQUIRED')

        # Gouvernante assigne l'agent
        self.client.force_authenticate(self.gouvernante)
        r = self.client.post(
            f'/api/v1/hotel/housekeeping/{task.id}/assign/',
            {'assigned_to': str(self.agent.id)},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.content)
        task.refresh_from_db()
        self.assertEqual(task.status, 'ASSIGNED')
        self.assertEqual(task.assigned_to_id, self.agent.id)

        # Agent démarre puis termine → INSPECTION
        self.client.force_authenticate(self.agent)
        r = self.client.post(f'/api/v1/hotel/housekeeping/{task.id}/start/', {}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        r = self.client.post(
            f'/api/v1/hotel/housekeeping/{task.id}/complete/',
            {'mark_ready': False},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.room.refresh_from_db()
        self.assertEqual(self.room.housekeeping_status, 'INSPECTION')
        self.assertEqual(self.room.operational_status, 'CLEANING')

        # Chambre pas encore revendable pour arrivée aujourd'hui
        from hotel.services import available_rooms
        free = available_rooms(self.hotel, self.room_type.id, date.today(), date.today() + timedelta(days=1))
        self.assertNotIn(self.room, free)

        # Gouvernante valide Prête
        self.client.force_authenticate(self.gouvernante)
        r = self.client.post(f'/api/v1/hotel/rooms/{self.room.id}/mark-ready/', {}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.room.refresh_from_db()
        self.assertEqual(self.room.housekeeping_status, 'READY')
        self.assertEqual(self.room.operational_status, 'AVAILABLE')

        free = available_rooms(self.hotel, self.room_type.id, date.today(), date.today() + timedelta(days=1))
        self.assertIn(self.room, free)

    def test_agent_signals_maintenance_then_returns_to_hk(self):
        stay = self._in_house_stay()
        check_out_stay(stay, self.reception)
        task = HousekeepingTask.objects.filter(hotel=self.hotel, room=self.room).latest('created_at')

        self.client.force_authenticate(self.gouvernante)
        self.client.post(
            f'/api/v1/hotel/housekeeping/{task.id}/assign/',
            {'assigned_to': str(self.agent.id)},
            format='json',
        )

        self.client.force_authenticate(self.agent)
        self.client.post(f'/api/v1/hotel/housekeeping/{task.id}/start/', {}, format='json')
        r = self.client.post(
            f'/api/v1/hotel/housekeeping/{task.id}/report-issue/',
            {
                'description': 'Robinet cassé',
                'blocks_room': True,
                'priority': 'HIGH',
            },
            format='json',
        )
        self.assertEqual(r.status_code, 201, r.content)
        ticket = MaintenanceTicket.objects.get(id=r.data['id'])
        self.assertEqual(ticket.category, 'HOUSEKEEPING')
        self.assertEqual(ticket.opened_by_id, self.agent.id)
        self.room.refresh_from_db()
        self.assertEqual(self.room.operational_status, 'MAINTENANCE')

        # Maintenance résout → nouvelle tâche ménage + notif gouvernante
        mail.outbox.clear()
        self.client.force_authenticate(self.maint)
        r = self.client.post(f'/api/v1/hotel/maintenance/{ticket.id}/resolve/', {}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.room.refresh_from_db()
        self.assertEqual(self.room.housekeeping_status, 'CLEANING_REQUIRED')
        follow = HousekeepingTask.objects.filter(
            hotel=self.hotel, room=self.room, comment__icontains='maintenance',
        ).exclude(pk=task.pk)
        self.assertTrue(follow.exists(), 'Après maintenance, une tâche ménage doit être créée')
        gov_mails = [m for m in mail.outbox if self.gouvernante.email in m.to]
        self.assertTrue(gov_mails, 'La gouvernante doit être notifiée après résolution maintenance')

    def test_agent_cannot_assign_or_mark_ready(self):
        stay = self._in_house_stay()
        check_out_stay(stay, self.reception)
        task = HousekeepingTask.objects.filter(hotel=self.hotel, room=self.room).latest('created_at')

        self.client.force_authenticate(self.agent)
        r = self.client.post(
            f'/api/v1/hotel/housekeeping/{task.id}/assign/',
            {'assigned_to': str(self.agent.id)},
            format='json',
        )
        self.assertIn(r.status_code, (403, 401))

        r = self.client.post(f'/api/v1/hotel/rooms/{self.room.id}/mark-ready/', {}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_resolve_rate_plan_auto_creates_from_base_price(self):
        from hotel.models import RatePlan
        from hotel.rate_resolution import resolve_rate_plan

        bare = RoomType.objects.create(
            hotel=self.hotel, name='Suite Auto', base_price=Decimal('75000'),
        )
        self.assertFalse(RatePlan.objects.filter(room_type=bare).exists())
        mail.outbox.clear()
        rate, meta = resolve_rate_plan(self.hotel, bare, auto_create=True, notify=True)
        self.assertIsNotNone(rate)
        self.assertTrue(meta.get('created'))
        self.assertEqual(rate.price_per_night, Decimal('75000'))
        self.assertTrue(RatePlan.objects.filter(room_type=bare, is_active=True).exists())
        # Ops notified (owner at minimum)
        self.assertTrue(any(self.owner.email in m.to for m in mail.outbox) or meta.get('notified'))


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class HotelReservationReplyTests(TestCase):
    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-reply')
        self.owner = User.objects.create_user(
            email='owner-reply@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel Reply',
            email='hotel-reply@test.bi',
        )
        HotelProfile.objects.get_or_create(business=self.hotel, defaults={'trade_name': 'Hôtel Reply'})
        self.agent = self._staff('agent-res@hotel.test', 'Agent réservations', 'Agent résa')
        self.hk = self._staff('hk-reply@hotel.test', 'Agent de ménage', 'HK')
        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Standard', base_price=Decimal('40000'),
        )
        self.guest_user = User.objects.create_user(
            email='client-reply@test.bi', password='pass', role='CUSTOMER', first_name='Alice',
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            user=self.guest_user,
            first_name='Alice',
            last_name='Client',
            email='client-reply@test.bi',
        )
        today = date.today()
        self.reservation = Reservation.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            check_in_date=today + timedelta(days=2),
            check_out_date=today + timedelta(days=4),
            adults=1,
            amount_per_night=Decimal('40000'),
            total_amount=Decimal('80000'),
            status='PENDING',
            payment_status='UNPAID',
            special_requests='[2026-03-18 10:00 — Alice] Besoin d’un lit bébé',
            reference='RES-REPLY-0001',
        )
        self.client = APIClient()

    def _staff(self, email, role_name, position):
        user = User.objects.create_user(
            email=email, password='pass', role='CUSTOMER', first_name=role_name.split()[0],
        )
        perms, level = _role_perms(role_name)
        role = BusinessRole.objects.create(
            business=self.hotel,
            name=role_name,
            system_access_level=level,
            permissions=perms,
        )
        BusinessEmployee.objects.create(
            user=user, business=self.hotel, role=role, position=position, is_active=True,
        )
        return user

    def test_agent_can_reply_visible_in_special_requests(self):
        mail.outbox.clear()
        self.client.force_authenticate(self.agent)
        r = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/reply/',
            {'message': 'Lit bébé confirmé pour votre arrivée.'},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.reservation.refresh_from_db()
        self.assertIn('Lit bébé confirmé', self.reservation.special_requests)
        self.assertIn('Hôtel Reply', self.reservation.special_requests)
        self.assertTrue(any(self.guest.email in m.to for m in mail.outbox))

    def test_housekeeping_cannot_reply_without_permission(self):
        self.client.force_authenticate(self.hk)
        r = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/reply/',
            {'message': 'Non autorisé'},
            format='json',
        )
        self.assertEqual(r.status_code, 403)

    def test_reply_permission_in_agent_defaults(self):
        from hotel.permission_catalog import expand_hotel_permissions
        perms, _ = _role_perms('Agent réservations')
        eff = expand_hotel_permissions(perms)
        self.assertIn('hotel.reservations.reply', eff)

    def test_client_message_helpers(self):
        from hotel.client_messages import client_message_pending, has_client_message
        thread = (
            '[2026-03-18 10:00 — Alice] Besoin d’un lit bébé\n'
            '[2026-03-18 10:05 — Hôtel Reply · Agent] Confirmé'
        )
        self.assertTrue(has_client_message(thread))
        self.assertFalse(client_message_pending(thread))
        pending = thread + '\n[2026-03-18 11:00 — Alice] Merci, et un berceau ?'
        self.assertTrue(client_message_pending(pending))
        self.assertFalse(has_client_message('Vue mer svp'))


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class HotelDepartureReminderTests(TestCase):
    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-depart')
        self.owner = User.objects.create_user(
            email='owner-dep@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel Départ',
            email='hotel-dep@test.bi',
        )
        HotelProfile.objects.get_or_create(business=self.hotel, defaults={'trade_name': 'Hôtel Départ'})
        perms, level = _role_perms('Agent réservations')
        role = BusinessRole.objects.create(
            business=self.hotel, name='Agent réservations',
            system_access_level=level, permissions=perms,
        )
        self.agent = User.objects.create_user(
            email='agent-dep@hotel.test', password='pass', role='CUSTOMER', first_name='Agent',
        )
        BusinessEmployee.objects.create(
            user=self.agent, business=self.hotel, role=role, position='Agent', is_active=True,
        )
        self.guest_user = User.objects.create_user(
            email='guest-dep@test.bi', password='pass', role='CUSTOMER', first_name='Bob',
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel, user=self.guest_user,
            first_name='Bob', last_name='Client', email='guest-dep@test.bi',
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Standard', base_price=Decimal('30000'),
        )
        today = date.today()
        self.reservation = Reservation.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            check_in_date=today - timedelta(days=1),
            check_out_date=today + timedelta(days=1),
            adults=1,
            amount_per_night=Decimal('30000'),
            total_amount=Decimal('60000'),
            status='CHECKED_IN',
            payment_status='PAID',
            reference='RES-DEP-0001',
        )

    def test_process_sends_staff_and_client_once(self):
        from hotel.departure_reminders import process_departure_reminders
        mail.outbox.clear()
        r1 = process_departure_reminders(hotel=self.hotel)
        self.assertEqual(r1['sent'], 1)
        self.reservation.refresh_from_db()
        self.assertIsNotNone(self.reservation.departure_reminder_sent_at)
        self.assertIn('termine demain', self.reservation.departure_reminder_note.lower().replace('é', 'e'))
        recipients = {addr for m in mail.outbox for addr in m.to}
        self.assertIn(self.guest.email, recipients)
        self.assertTrue(self.owner.email in recipients or self.agent.email in recipients)
        mail.outbox.clear()
        r2 = process_departure_reminders(hotel=self.hotel)
        self.assertEqual(r2['sent'], 0)
        self.assertEqual(len(mail.outbox), 0)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    BURUNDIPAY_STUB=True,
    DEBUG=True,
)
class HotelCashierTests(TestCase):
    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-cashier')
        self.owner = User.objects.create_user(
            email='owner-cash@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel Caisse',
            email='hotel-cash@test.bi',
        )
        HotelProfile.objects.get_or_create(business=self.hotel, defaults={'trade_name': 'Hôtel Caisse'})
        self.cashier = self._staff('caissier@hotel.test', 'Caissier', 'Caissier')
        self.reception = self._staff('front-cash@hotel.test', 'Réceptionniste', 'Réception')
        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Standard', base_price=Decimal('60000'),
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            room_type=self.room_type,
            number='201',
            operational_status='AVAILABLE',
            housekeeping_status='READY',
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel, first_name='Jean', last_name='Payeur', email='jean@test.bi', phone='79123456',
        )
        self.client = APIClient()

    def _staff(self, email, role_name, position):
        user = User.objects.create_user(
            email=email, password='pass', role='CUSTOMER', first_name=role_name.split()[0],
        )
        perms, level = _role_perms(role_name)
        role = BusinessRole.objects.create(
            business=self.hotel,
            name=role_name,
            system_access_level=level,
            permissions=perms,
        )
        BusinessEmployee.objects.create(
            user=user, business=self.hotel, role=role, position=position, is_active=True,
        )
        return user

    def _open_folio(self):
        today = date.today()
        res = Reservation.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            check_in_date=today,
            check_out_date=today + timedelta(days=1),
            adults=1,
            amount_per_night=Decimal('60000'),
            total_amount=Decimal('60000'),
            status='CONFIRMED',
            payment_status='UNPAID',
            reference=f'RES-CASH-{User.objects.count():06d}',
        )
        stay = check_in_reservation(res, self.room, self.reception)
        stay.folio.recalculate()
        return stay.folio

    def test_cash_payment_returns_receipt(self):
        folio = self._open_folio()
        self.client.force_authenticate(self.cashier)
        r = self.client.post(
            '/api/v1/hotel/payments/',
            {'folio': str(folio.id), 'amount': '15000', 'method': 'CASH'},
            format='json',
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIn('receipt', r.data)
        self.assertTrue(r.data['receipt']['receipt_number'].startswith('REC-'))
        self.assertEqual(r.data['receipt']['payment']['method'], 'CASH')
        self.assertEqual(r.data['receipt']['guest']['name'].strip(), 'Jean Payeur')

        rid = r.data['id']
        r2 = self.client.get(f'/api/v1/hotel/payments/{rid}/receipt/')
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.data['receipt_number'], r.data['receipt']['receipt_number'])

    def test_cash_close_blocks_further_payments(self):
        folio = self._open_folio()
        self.client.force_authenticate(self.cashier)
        r = self.client.post(
            '/api/v1/hotel/payments/',
            {'folio': str(folio.id), 'amount': '10000', 'method': 'CASH'},
            format='json',
        )
        self.assertEqual(r.status_code, 201, r.content)

        close = self.client.post(
            '/api/v1/hotel/cash-closings/',
            {'period_date': str(date.today())},
            format='json',
        )
        self.assertEqual(close.status_code, 201, close.content)
        self.assertTrue(close.data.get('is_locked'))

        dash = self.client.get('/api/v1/hotel/cashier-dashboard/')
        self.assertEqual(dash.status_code, 200, dash.content)
        self.assertTrue(dash.data['cash_closed_today'])

        blocked = self.client.post(
            '/api/v1/hotel/payments/',
            {'folio': str(folio.id), 'amount': '5000', 'method': 'CASH'},
            format='json',
        )
        self.assertEqual(blocked.status_code, 400, blocked.content)

    def test_folio_burundipay_stub_flow(self):
        folio = self._open_folio()
        self.client.force_authenticate(self.cashier)
        init = self.client.post(
            f'/api/v1/hotel/folios/{folio.id}/pay-burundipay/',
            {'amount': '20000', 'payer_phone': '79123456'},
            format='json',
        )
        self.assertEqual(init.status_code, 200, init.content)
        self.assertTrue(init.data['ok'])
        self.assertEqual(init.data['payment']['status'], 'AWAITING_PIN')
        payment_id = init.data['payment']['id']

        confirm = self.client.post(
            f'/api/v1/hotel/folios/{folio.id}/confirm-burundipay/',
            {'payment_id': payment_id},
            format='json',
        )
        self.assertEqual(confirm.status_code, 200, confirm.content)
        self.assertTrue(confirm.data['ok'])
        self.assertEqual(confirm.data['payment']['status'], 'PAID')

        folio.refresh_from_db()
        self.assertEqual(folio.paid_amount, Decimal('20000.00'))


class HotelPublicBookAndTenantTests(TestCase):
    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-public-book')
        self.owner = User.objects.create_user(
            email='owner-pub@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.other_owner = User.objects.create_user(
            email='other-pub@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel Public',
            email='pub@hotel.test',
            is_active=True,
            is_verified=True,
        )
        HotelProfile.objects.get_or_create(
            business=self.hotel,
            defaults={'trade_name': 'Hôtel Public', 'status': 'ACTIVE'},
        )
        self.other = Business.objects.create(
            owner=self.other_owner,
            primary_category=cat,
            category=cat,
            name='Autre Hôtel',
            email='other@hotel.test',
            is_active=True,
            is_verified=True,
        )
        HotelProfile.objects.get_or_create(
            business=self.other,
            defaults={'trade_name': 'Autre', 'status': 'ACTIVE'},
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Double', base_price=Decimal('80000'),
            capacity_adults=2, capacity_children=1,
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            room_type=self.room_type,
            number='201',
            operational_status='AVAILABLE',
            housekeeping_status='READY',
        )
        self.client = APIClient()

    def test_public_book_creates_pending(self):
        ci = date.today() + timedelta(days=2)
        co = ci + timedelta(days=2)
        r = self.client.post(
            f'/api/v1/hotel/public/hotels/{self.hotel.id}/book/',
            {
                'room_type': str(self.room_type.id),
                'check_in_date': str(ci),
                'check_out_date': str(co),
                'first_name': 'Alice',
                'last_name': 'Guest',
                'email': 'alice@guest.test',
                'phone': '79000001',
                'adults': 1,
                'children': 0,
            },
            format='json',
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data.get('status') or r.data.get('reservation', {}).get('status'), 'PENDING')

    def test_double_booking_blocked(self):
        from hotel.services import available_rooms
        ci = date.today() + timedelta(days=5)
        co = ci + timedelta(days=2)
        # Première réservation consomme la seule chambre
        self.client.post(
            f'/api/v1/hotel/public/hotels/{self.hotel.id}/book/',
            {
                'room_type': str(self.room_type.id),
                'check_in_date': str(ci),
                'check_out_date': str(co),
                'first_name': 'Bob',
                'last_name': 'One',
                'email': 'bob@guest.test',
                'adults': 1,
            },
            format='json',
        )
        # Assign room to block availability like confirmed occupancy
        res = Reservation.objects.filter(hotel=self.hotel).latest('created_at')
        res.room = self.room
        res.status = 'CONFIRMED'
        res.save(update_fields=['room', 'status'])
        free = available_rooms(self.hotel, self.room_type.id, ci, co)
        self.assertEqual(list(free), [])
        r2 = self.client.post(
            f'/api/v1/hotel/public/hotels/{self.hotel.id}/book/',
            {
                'room_type': str(self.room_type.id),
                'check_in_date': str(ci),
                'check_out_date': str(co),
                'first_name': 'Carol',
                'last_name': 'Two',
                'email': 'carol@guest.test',
                'adults': 1,
            },
            format='json',
        )
        self.assertEqual(r2.status_code, 400, r2.content)

    def test_cross_tenant_rooms_forbidden(self):
        self.client.force_authenticate(self.other_owner)
        r = self.client.get('/api/v1/hotel/rooms/')
        self.assertEqual(r.status_code, 200, r.content)
        results = r.data if isinstance(r.data, list) else r.data.get('results', [])
        ids = {str(x.get('id') or x.get('pk')) for x in results}
        self.assertNotIn(str(self.room.id), ids)

    def test_calendar_and_reports_endpoints(self):
        self.client.force_authenticate(self.owner)
        cal = self.client.get('/api/v1/hotel/calendar/')
        self.assertEqual(cal.status_code, 200, cal.content)
        self.assertIn('rooms', cal.data)
        self.assertIn('events', cal.data)
        rep = self.client.get('/api/v1/hotel/reports/')
        self.assertEqual(rep.status_code, 200, rep.content)
        self.assertIn('summary', rep.data)
        self.assertIn('daily', rep.data)
        csv_rep = self.client.get('/api/v1/hotel/reports/?export=csv')
        self.assertEqual(csv_rep.status_code, 200, csv_rep.content)
        self.assertIn('text/csv', csv_rep['Content-Type'])
        body = csv_rep.content.decode('utf-8-sig')
        self.assertIn('Occupation moy.', body)
        self.assertIn('ADR', body)
        self.assertIn('RevPAR', body)

    def test_platform_hotels_super_admin(self):
        admin = User.objects.create_user(
            email='sa@hotel.test', password='pass', role='SUPER_ADMIN', is_superuser=True,
        )
        self.client.force_authenticate(admin)
        r = self.client.get('/api/v1/hotel/platform/hotels/')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertGreaterEqual(r.data.get('count', 0), 1)

        verify = self.client.post(
            f'/api/v1/hotel/platform/hotels/{self.hotel.id}/verify-classification/',
            {'stars_verified': 4, 'classification_verified': True, 'note': 'Contrôle OT'},
            format='json',
        )
        self.assertEqual(verify.status_code, 200, verify.content)
        self.assertEqual(verify.data.get('stars_verified'), 4)
        self.assertTrue(verify.data.get('classification_verified'))
        from accounts.models import AuditLog
        from hotel.models import HotelAuditLog
        self.assertTrue(
            AuditLog.objects.filter(action='HOTEL_CLASSIFICATION_VERIFIED').exists()
        )
        self.assertTrue(
            HotelAuditLog.objects.filter(
                hotel=self.hotel, action='CLASSIFICATION_VERIFY',
            ).exists()
        )


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class HotelReservationRefuseMotifTests(TestCase):
    """Refus PENDING : motif obligatoire, stocké et envoyé par email."""

    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-refuse-motif')
        self.owner = User.objects.create_user(
            email='owner-refuse@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel Refus',
            email='hotel-refuse@test.bi',
        )
        HotelProfile.objects.get_or_create(
            business=self.hotel,
            defaults={
                'trade_name': 'Hôtel Refus',
                'reservation_reject_email_message': (
                    'Bonjour {guest_name},\nMotif : {reason}\nRéf {reference}\n'
                ),
            },
        )
        perms, level = _role_perms('Agent réservations')
        role = BusinessRole.objects.create(
            business=self.hotel,
            name='Agent réservations',
            system_access_level=level,
            permissions=perms,
        )
        self.agent = User.objects.create_user(
            email='agent-refuse@hotel.test', password='pass', role='CUSTOMER',
        )
        BusinessEmployee.objects.create(
            user=self.agent, business=self.hotel, role=role,
            position='Agent', is_active=True,
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Std', base_price=Decimal('30000'),
        )
        self.client_user = User.objects.create_user(
            email='bob-refuse@test.bi', password='pass', role='CUSTOMER', first_name='Bob',
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel, first_name='Bob', last_name='Client',
            email='bob-refuse@test.bi',
            user=self.client_user,
        )
        today = date.today()
        self.reservation = Reservation.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            check_in_date=today + timedelta(days=3),
            check_out_date=today + timedelta(days=5),
            adults=1,
            amount_per_night=Decimal('30000'),
            total_amount=Decimal('60000'),
            status='PENDING',
            payment_status='UNPAID',
            reference='RES-REFUSE-0001',
        )
        self.client = APIClient()

    def test_refuse_without_motif_rejected(self):
        self.client.force_authenticate(self.agent)
        r = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/cancel/',
            {},
            format='json',
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.reservation.refresh_from_db()
        self.assertEqual(self.reservation.status, 'PENDING')

    def test_refuse_with_motif_saves_and_emails(self):
        mail.outbox.clear()
        self.client.force_authenticate(self.agent)
        motif = 'Plus de chambres disponibles pour ces dates.'
        r = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/cancel/',
            {'reason': motif},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.reservation.refresh_from_db()
        self.assertEqual(self.reservation.status, 'CANCELLED')
        self.assertEqual(self.reservation.decision_note, motif)
        self.assertTrue(self.reservation.decision_at)
        self.assertIn(f'Refus : {motif}', self.reservation.special_requests or '')
        self.assertTrue(mail.outbox, 'email de refus attendu')
        body = mail.outbox[0].body
        self.assertIn(motif, body)
        from hospital.models import Notification
        notif = Notification.objects.filter(user=self.client_user).order_by('-created_at').first()
        self.assertIsNotNone(notif)
        self.assertIn('refus', (notif.title or '').lower())
        self.assertIn(motif, notif.message or '')
        self.assertIn('/hotels/', notif.message or '')
        self.assertFalse(notif.is_read)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class HotelReservationRefundThenRefuseTests(TestCase):
    """PAID → refus bloqué → refund → refus OK avec motif."""

    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-refund-refuse')
        self.owner = User.objects.create_user(
            email='owner-refund@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel Refund',
            email='hotel-refund@test.bi',
        )
        HotelProfile.objects.get_or_create(business=self.hotel, defaults={'trade_name': 'Hôtel Refund'})
        perms, level = _role_perms('Agent réservations')
        role = BusinessRole.objects.create(
            business=self.hotel,
            name='Agent réservations',
            system_access_level=level,
            permissions=perms,
        )
        self.agent = User.objects.create_user(
            email='agent-refund@hotel.test', password='pass', role='CUSTOMER',
        )
        BusinessEmployee.objects.create(
            user=self.agent, business=self.hotel, role=role,
            position='Agent', is_active=True,
        )
        self.client_user = User.objects.create_user(
            email='client-refund@test.bi', password='pass', role='CUSTOMER',
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Std', base_price=Decimal('50000'),
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel, first_name='Sam', last_name='Payé',
            email='client-refund@test.bi', user=self.client_user,
        )
        today = date.today()
        self.reservation = Reservation.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            check_in_date=today + timedelta(days=4),
            check_out_date=today + timedelta(days=6),
            adults=1,
            amount_per_night=Decimal('50000'),
            total_amount=Decimal('100000'),
            status='PENDING',
            payment_status='PAID',
            reference='RES-REFUND-0001',
        )
        self.client = APIClient()

    def test_refuse_paid_blocked_until_refund(self):
        self.client.force_authenticate(self.agent)
        # 1) Refus direct sur PAID → bloqué
        blocked = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/cancel/',
            {'reason': 'Chambre indisponible demain.'},
            format='json',
        )
        self.assertEqual(blocked.status_code, 400, blocked.content)
        body = blocked.json() if hasattr(blocked, 'json') else blocked.data
        err = body.get('payment_status') or body.get('code') or str(body)
        self.assertTrue(
            'REFUND' in str(body).upper() or 'Rembours' in str(err),
            msg=body,
        )
        self.reservation.refresh_from_db()
        self.assertEqual(self.reservation.status, 'PENDING')
        self.assertEqual(self.reservation.payment_status, 'PAID')

        # 2) Remboursement
        refund = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/refund/',
            {'note': 'Remboursé avant refus'},
            format='json',
        )
        self.assertEqual(refund.status_code, 200, refund.content)
        self.reservation.refresh_from_db()
        self.assertEqual(self.reservation.payment_status, 'REFUNDED')

        # 3) Refus avec motif
        motif = 'Plus de disponibilité après remboursement.'
        refused = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/cancel/',
            {'reason': motif},
            format='json',
        )
        self.assertEqual(refused.status_code, 200, refused.content)
        self.reservation.refresh_from_db()
        self.assertEqual(self.reservation.status, 'CANCELLED')
        self.assertEqual(self.reservation.decision_note, motif)
        self.assertIn(f'Refus : {motif}', self.reservation.special_requests or '')
        from hospital.models import Notification
        self.assertTrue(
            Notification.objects.filter(user=self.client_user, title__icontains='refus').exists()
        )


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    BURUNDIPAY_STUB=True,
)
class HotelReservationNoShowTests(TestCase):
    """CONFIRMED → no-show libère la chambre ; PAID bloque sans refund."""

    def setUp(self):
        cat = BusinessCategory.objects.create(name='Hôtel', slug='hotel-noshow')
        self.owner = User.objects.create_user(
            email='owner-noshow@hotel.test', password='pass', role='BUSINESS_OWNER',
        )
        self.hotel = Business.objects.create(
            owner=self.owner,
            primary_category=cat,
            category=cat,
            name='Hôtel NoShow',
            email='hotel-noshow@test.bi',
        )
        HotelProfile.objects.get_or_create(business=self.hotel, defaults={'trade_name': 'Hôtel NoShow'})
        perms, level = _role_perms('Agent réservations')
        role = BusinessRole.objects.create(
            business=self.hotel,
            name='Agent réservations',
            system_access_level=level,
            permissions=perms,
        )
        self.agent = User.objects.create_user(
            email='agent-noshow@hotel.test', password='pass', role='CUSTOMER',
        )
        BusinessEmployee.objects.create(
            user=self.agent, business=self.hotel, role=role,
            position='Agent', is_active=True,
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel, name='Dbl', base_price=Decimal('40000'),
        )
        self.room = Room.objects.create(
            hotel=self.hotel, room_type=self.room_type, number='12',
            operational_status='RESERVED',
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel, first_name='No', last_name='Show',
            email='noshow@test.bi',
        )
        today = date.today()
        self.reservation = Reservation.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            check_in_date=today,
            check_out_date=today + timedelta(days=2),
            adults=1,
            amount_per_night=Decimal('40000'),
            total_amount=Decimal('80000'),
            status='CONFIRMED',
            payment_status='PAID',
            payment_method='CASH',
            reference='RES-NOSHOW-0001',
        )
        self.client = APIClient()

    def test_no_show_requires_refund_when_paid(self):
        self.client.force_authenticate(self.agent)
        blocked = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/no-show/',
            {'note': 'Client absent à 18h'},
            format='json',
        )
        self.assertEqual(blocked.status_code, 400, blocked.content)

        refund = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/refund/',
            {'note': 'Remboursement espèces'},
            format='json',
        )
        self.assertEqual(refund.status_code, 200, refund.content)

        ok = self.client.post(
            f'/api/v1/hotel/reservations/{self.reservation.id}/no-show/',
            {'note': 'Client absent à 18h'},
            format='json',
        )
        self.assertEqual(ok.status_code, 200, ok.content)
        self.reservation.refresh_from_db()
        self.room.refresh_from_db()
        self.assertEqual(self.reservation.status, 'NO_SHOW')
        self.assertEqual(self.room.operational_status, 'AVAILABLE')
