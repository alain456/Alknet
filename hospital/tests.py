import uuid
from datetime import datetime, time, timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from businesses.models import Business, BusinessEmployee, BusinessRole
from business_categories.models import BusinessCategory
from hospital.models import DoctorProfile, Specialty, Appointment, Notification, AppointmentSlot, DoctorSchedule
from hospital.schedule_dynamics import HOSPITAL_TZ, planning_alert_payload, roll_expired_slots, hospital_now

User = get_user_model()


class HospitalAppointmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.owner = User.objects.create_user(
            email='owner@hopital.bi', password='Pass123456!', role='BUSINESS_OWNER'
        )
        self.patient = User.objects.create_user(
            email='patient@hopital.bi', password='Pass123456!', role='CUSTOMER',
            first_name='Marie', last_name='Keza',
        )

        self.category = BusinessCategory.objects.create(name='Hôpital', slug='hopital')
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            name='Hôpital Baho',
            province='Bujumbura Mairie',
        )

        self.doctor_user = User.objects.create_user(
            email='medecin@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Paul', last_name='Nkurunziza',
        )
        self.specialty = Specialty.objects.create(name='Médecine générale')
        self.doctor = DoctorProfile.objects.create(
            user=self.doctor_user,
            hospital=self.business,
            medical_license_number='LIC-001',
            staff_category='DOCTOR',
            consultation_fee=15000,
        )
        self.doctor.specialties.add(self.specialty)

        self.appointment_date = timezone.now() + timedelta(days=2)

    def test_public_appointment_creation(self):
        """Un patient doit réserver via un créneau publié par l'admin."""
        slot = AppointmentSlot.objects.create(
            hospital=self.business,
            doctor=self.doctor,
            title='Consultation test',
            slot_date=(timezone.now() + timedelta(days=3)).date(),
            start_time='09:00',
            end_time='12:00',
            max_patients=10,
            is_active=True,
            status='OPEN',
        )
        response = self.client.post('/api/v1/hospital/appointments/', {
            'slot': str(slot.id),
            'reason': 'Consultation de routine',
            'patient_name': 'Guest Patient',
            'patient_phone': '+25779111111',
            'patient_email': 'guest@test.bi',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Appointment.objects.count(), 1)
        appt = Appointment.objects.first()
        self.assertEqual(appt.status, 'PENDING')
        self.assertEqual(appt.slot_id, slot.id)
        self.assertEqual(appt.patient_contact_name, 'Guest Patient')
        self.assertEqual(appt.patient_contact_phone, '+25779111111')
        self.assertEqual(appt.patient_contact_email, 'guest@test.bi')
        self.assertTrue(appt.reference_code.startswith('RDV-'))
        self.assertEqual(response.data['patient_name'], 'Guest Patient')
        self.assertTrue(Notification.objects.filter(appointment=appt).count() >= 2)

    def test_owner_can_confirm_and_reject_appointment(self):
        slot = AppointmentSlot.objects.create(
            hospital=self.business,
            doctor=self.doctor,
            title='Consultation test',
            slot_date=(timezone.now() + timedelta(days=3)).date(),
            start_time='09:00',
            end_time='12:00',
            max_patients=10,
            is_active=True,
            status='OPEN',
        )
        appt = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            slot=slot,
            queue_number=1,
            reference_code='RDV-2026-00099',
            appointment_date=self.appointment_date,
            status='PENDING',
            patient_contact_name='Marie Keza',
            patient_contact_email='patient@hopital.bi',
        )
        self.client.force_authenticate(user=self.owner)
        confirm = self.client.post(f'/api/v1/hospital/appointments/{appt.id}/confirm/', {}, format='json')
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'CONFIRMED')

        appt2 = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            slot=slot,
            queue_number=2,
            reference_code='RDV-2026-00100',
            appointment_date=self.appointment_date,
            status='PENDING',
            patient_contact_email='patient@hopital.bi',
        )
        reject = self.client.post(
            f'/api/v1/hospital/appointments/{appt2.id}/reject/',
            {'reason': 'Créneau complet'},
            format='json',
        )
        self.assertEqual(reject.status_code, status.HTTP_200_OK)
        appt2.refresh_from_db()
        self.assertEqual(appt2.status, 'REJECTED')
        self.assertEqual(appt2.cancellation_reason, 'Créneau complet')

    def test_public_booking_requires_published_slot(self):
        """Sans créneau publié, la réservation client est refusée."""
        response = self.client.post('/api/v1/hospital/appointments/', {
            'hospital': str(self.business.id),
            'doctor': str(self.doctor.id),
            'appointment_date': self.appointment_date.isoformat(),
            'reason': 'Test',
            'patient_email': 'guest2@test.bi',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_authenticated_patient_lists_own_appointments(self):
        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            appointment_date=self.appointment_date,
            reason='Suivi',
        )
        self.client.force_authenticate(user=self.patient)
        response = self.client.get('/api/v1/hospital/appointments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_patient_can_cancel_appointment(self):
        appt = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            appointment_date=self.appointment_date,
            status='PENDING',
        )
        self.client.force_authenticate(user=self.patient)
        response = self.client.post(f'/api/v1/hospital/appointments/{appt.id}/cancel/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'CANCELLED')

    def test_doctor_sees_only_own_appointments(self):
        other_doctor_user = User.objects.create_user(
            email='other@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
        )
        other_doctor = DoctorProfile.objects.create(
            user=other_doctor_user,
            hospital=self.business,
            medical_license_number='LIC-002',
            staff_category='DOCTOR',
        )
        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            appointment_date=self.appointment_date,
            reference_code='RDV-2026-00001',
        )
        Appointment.objects.create(
            patient=self.patient,
            doctor=other_doctor,
            hospital=self.business,
            appointment_date=self.appointment_date,
            reference_code='RDV-2026-00002',
        )
        self.client.force_authenticate(user=self.doctor_user)
        response = self.client.get(f'/api/v1/hospital/appointments/?hospital={self.business.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['reference_code'], 'RDV-2026-00001')

    def test_business_owner_sees_hospital_appointments(self):
        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            appointment_date=self.appointment_date,
            reference_code='RDV-2026-00003',
        )
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f'/api/v1/hospital/appointments/?hospital={self.business.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)


class DynamicDoctorScheduleTests(TestCase):
    """Créneau dépassé → prochaine occurrence, et alertes admin."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-planning@hopital.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.patient = User.objects.create_user(
            email='patient-planning@hopital.bi', password='Pass123456!', role='CUSTOMER',
            first_name='Aline', last_name='Ndayishimiye',
        )
        self.category = BusinessCategory.objects.create(name='Hôpital Planning', slug='hopital-planning')
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            name='Clinique Nyarugusu',
            province='Bujumbura Mairie',
        )
        self.doctor_user = User.objects.create_user(
            email='medecin-planning@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Jean', last_name='Hakizimana',
        )
        self.doctor = DoctorProfile.objects.create(
            user=self.doctor_user,
            hospital=self.business,
            medical_license_number='LIC-PLAN-001',
            staff_category='DOCTOR',
        )
        self.now = datetime(2026, 9, 22, 17, 0, tzinfo=HOSPITAL_TZ)  # mardi 17:00
        self.today = self.now.date()

    def _schedule(self):
        return DoctorSchedule.objects.create(
            doctor=self.doctor,
            hospital=self.business,
            day_of_week=1,
            start_time=time(8, 0),
            end_time=time(16, 0),
            is_available=True,
        )

    def _slot(self, slot_date, **kwargs):
        defaults = dict(
            hospital=self.business,
            doctor=self.doctor,
            title='Consultation',
            slot_date=slot_date,
            start_time=time(8, 0),
            end_time=time(16, 0),
            max_patients=8,
            is_active=True,
            status='OPEN',
        )
        defaults.update(kwargs)
        return AppointmentSlot.objects.create(**defaults)

    def test_expired_slot_rolls_to_next_week_with_fresh_capacity(self):
        self._schedule()
        expired = self._slot(self.today)
        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            slot=expired,
            appointment_date=self.now,
            reference_code='RDV-PLAN-00001',
            status='CONFIRMED',
        )

        rolled = roll_expired_slots(self.business, now=self.now)

        expired.refresh_from_db()
        self.assertEqual(expired.status, 'CLOSED')
        self.assertEqual(len(rolled), 1)
        nxt = rolled[0]
        self.assertEqual(nxt.slot_date, self.today + timedelta(days=7))
        self.assertEqual(nxt.status, 'OPEN')
        self.assertTrue(nxt.is_active)
        self.assertEqual(nxt.booked_count, 0)
        self.assertEqual(expired.booked_count, 1)

    def test_slot_still_in_progress_is_not_reset(self):
        self._schedule()
        slot = self._slot(self.today)
        earlier = self.now.replace(hour=10)
        rolled = roll_expired_slots(self.business, now=earlier)
        slot.refresh_from_db()
        self.assertEqual(rolled, [])
        self.assertEqual(slot.status, 'OPEN')

    def test_does_not_duplicate_an_existing_next_occurrence(self):
        self._schedule()
        self._slot(self.today)
        upcoming = self._slot(self.today + timedelta(days=7))
        rolled = roll_expired_slots(self.business, now=self.now)
        self.assertEqual(rolled, [])
        upcoming.refresh_from_db()
        self.assertEqual(upcoming.status, 'OPEN')
        self.assertEqual(
            AppointmentSlot.objects.filter(doctor=self.doctor, status='OPEN').count(),
            1,
        )

    def test_admin_is_alerted_without_slot_or_appointment(self):
        payload = planning_alert_payload(self.business, now=self.now)
        self.assertEqual(len(payload['missing_slots']), 1)
        self.assertEqual(payload['missing_slots'][0]['reason'], 'Aucun horaire configuré')

        self._schedule()
        payload = planning_alert_payload(self.business, now=self.now)
        self.assertEqual(payload['missing_slots'][0]['reason'], 'Aucun créneau programmé')
        self.assertEqual(payload['missing_appointments'], [])

        slot = self._slot(self.today + timedelta(days=7))
        payload = planning_alert_payload(self.business, now=self.now)
        self.assertEqual(payload['missing_slots'], [])
        self.assertEqual(len(payload['missing_appointments']), 1)
        self.assertEqual(payload['missing_appointments'][0]['slot_id'], str(slot.id))
        self.assertIn('rendez-vous', payload['missing_appointments'][0]['reason'])

        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            slot=slot,
            appointment_date=datetime(2026, 9, 29, 9, 0, tzinfo=HOSPITAL_TZ),
            reference_code='RDV-PLAN-00002',
            status='PENDING',
        )
        payload = planning_alert_payload(self.business, now=self.now)
        self.assertEqual(payload['alert_count'], 0)

    def test_schedule_date_sets_end_and_rolls_forward(self):
        schedule = DoctorSchedule.objects.create(
            doctor=self.doctor,
            hospital=self.business,
            schedule_date=self.today,
            day_of_week=1,
            start_time=time(8, 0),
            end_time=time(16, 0),
            is_available=True,
        )
        roll_expired_slots(self.business, now=self.now.replace(hour=15))
        schedule.refresh_from_db()
        self.assertEqual(schedule.schedule_date, self.today)

        roll_expired_slots(self.business, now=self.now)
        schedule.refresh_from_db()
        self.assertEqual(schedule.schedule_date, self.today + timedelta(days=7))

        self.client.force_authenticate(user=self.owner)
        created = self.client.post('/api/v1/hospital/schedules/', {
            'doctor': str(self.doctor.id),
            'hospital': str(self.business.id),
            'schedule_date': '2026-09-23',
            'day_of_week': 0,
            'start_time': '20:00',
            'end_time': '06:00',
            'is_available': True,
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data['day_of_week'], 2)
        self.assertEqual(created.data['ends_at'], '2026-09-24T06:00')
        self.assertTrue(created.data['ends_next_day'])

    def test_planning_alerts_endpoint(self):
        self._schedule()
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(
            f'/api/v1/hospital/schedules/planning_alerts/?hospital={self.business.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['missing_slots'][0]['reason'], 'Aucun créneau programmé')
        self.assertGreaterEqual(response.data['alert_count'], 1)


class AccountantPublicVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-compta@hopital.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.category = BusinessCategory.objects.create(name='Hôpital compta', slug='hopital-compta')
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            name='Hôpital Compta',
            province='Bujumbura Mairie',
        )
        self.doctor_user = User.objects.create_user(
            email='medecin-compta@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Aline', last_name='Ndayishimiye',
        )
        self.doctor = DoctorProfile.objects.create(
            user=self.doctor_user,
            hospital=self.business,
            medical_license_number='LIC-COMPTA-DOC',
            staff_category='DOCTOR',
            is_public_directory=True,
            consultation_fee=10000,
        )
        self.accountant_user = User.objects.create_user(
            email='comptable@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Fo', last_name='Compta',
        )
        self.role = BusinessRole.objects.create(
            business=self.business,
            name='Comptable',
            system_access_level='STAFF_ACCESS',
            permissions=['can_manage_invoices'],
        )
        BusinessEmployee.objects.create(
            user=self.accountant_user,
            business=self.business,
            role=self.role,
            position='Médecin',
        )
        self.accountant = DoctorProfile.objects.create(
            user=self.accountant_user,
            hospital=self.business,
            medical_license_number='LIC-COMPTA-ACC',
            staff_category='DOCTOR',
            professional_title='DR',
            is_public_directory=True,
            consultation_fee=0,
        )
        slot_date = (timezone.now() + timedelta(days=4)).date()
        AppointmentSlot.objects.create(
            hospital=self.business,
            doctor=self.accountant,
            title='Session comptable',
            slot_date=slot_date,
            start_time='08:00',
            end_time='12:00',
            max_patients=5,
            is_active=True,
            status='OPEN',
        )
        AppointmentSlot.objects.create(
            hospital=self.business,
            doctor=self.doctor,
            title='Consultation générale',
            slot_date=slot_date,
            start_time='08:00',
            end_time='12:00',
            max_patients=5,
            is_active=True,
            status='OPEN',
        )

    def test_comptable_is_hidden_from_public_directory_and_slots(self):
        doctors = self.client.get(f'/api/v1/hospital/doctors/?hospital={self.business.id}&public=true')
        self.assertEqual(doctors.status_code, status.HTTP_200_OK)
        payload = doctors.data.get('results', doctors.data) if isinstance(doctors.data, dict) else doctors.data
        ids = {str(item['id']) for item in payload}
        self.assertIn(str(self.doctor.id), ids)
        self.assertNotIn(str(self.accountant.id), ids)

        slots = self.client.get(
            f'/api/v1/hospital/appointment-slots/?hospital={self.business.id}&public=true'
        )
        self.assertEqual(slots.status_code, status.HTTP_200_OK)
        slot_payload = slots.data.get('results', slots.data) if isinstance(slots.data, dict) else slots.data
        doctor_ids = {str(item['doctor']) for item in slot_payload}
        self.assertIn(str(self.doctor.id), doctor_ids)
        self.assertNotIn(str(self.accountant.id), doctor_ids)


class HospitalAccountingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-acct@hopital.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.patient = User.objects.create_user(
            email='patient-acct@hopital.bi', password='Pass123456!', role='CUSTOMER',
            first_name='Aline', last_name='Keza',
        )
        self.doctor_user = User.objects.create_user(
            email='doc-acct@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Paul', last_name='Ndayi',
        )
        self.accountant_user = User.objects.create_user(
            email='compta-acct@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Chantal', last_name='Niyonzima',
        )
        self.category = BusinessCategory.objects.create(name='Hôpital comptes', slug='hopital-comptes')
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            name='Hôpital Comptes',
            province='Bujumbura Mairie',
        )
        self.doctor = DoctorProfile.objects.create(
            user=self.doctor_user,
            hospital=self.business,
            medical_license_number='LIC-ACCT-DOC',
            staff_category='DOCTOR',
            consultation_fee=20000,
        )
        role = BusinessRole.objects.create(
            business=self.business,
            name='Comptable',
            system_access_level='CASHIER_ACCESS',
            permissions=['can_manage_invoices'],
        )
        BusinessEmployee.objects.create(
            user=self.accountant_user,
            business=self.business,
            role=role,
            position='COMPTABLE',
        )
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            reference_code='RDV-ACCT-0001',
            appointment_date=hospital_now(),
            status='CONFIRMED',
            patient_contact_name='Aline Keza',
            consultation_fee_amount=20000,
            payment_status='PAID',
            payment_method='BURUNDIPAY',
            paid_at=hospital_now(),
        )

    def test_accountant_reconciles_payment_and_closes_day(self):
        self.client.force_authenticate(user=self.accountant_user)
        desk = self.client.get('/api/v1/hospital/invoices/desk/')
        self.assertEqual(desk.status_code, status.HTTP_200_OK)
        self.assertEqual(len(desk.data['day']['paid_without_invoice']), 1)

        created = self.client.post('/api/v1/hospital/invoices/from-appointment/', {
            'appointment': str(self.appointment.id),
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data['payment_method'], 'BURUNDIPAY')
        self.assertTrue(created.data['invoice_number'].startswith('FAC-'))

        desk = self.client.get('/api/v1/hospital/invoices/desk/')
        self.assertEqual(desk.data['day']['paid_without_invoice'], [])
        self.assertGreaterEqual(desk.data['day']['collected'], 20000)

        closing = self.client.post('/api/v1/hospital/invoices/close-day/', {}, format='json')
        self.assertEqual(closing.status_code, status.HTTP_201_CREATED, closing.data)
        again = self.client.post('/api/v1/hospital/invoices/close-day/', {}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(user=self.owner)
        owner_desk = self.client.get('/api/v1/hospital/invoices/desk/')
        self.assertEqual(owner_desk.status_code, status.HTTP_200_OK)
        self.assertTrue(owner_desk.data['closed'])
        self.assertEqual(len(owner_desk.data['recent_closings']), 1)

    def test_doctor_cannot_open_accounting(self):
        self.client.force_authenticate(user=self.doctor_user)
        desk = self.client.get('/api/v1/hospital/invoices/desk/')
        self.assertEqual(desk.status_code, status.HTTP_403_FORBIDDEN)



class LabWorkflowP0P3Tests(TestCase):
    """Prescription EXAM → labo → validation → facture → FHIR."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-lab@hopital.bi', password='Pass123456!', role='BUSINESS_OWNER'
        )
        self.patient = User.objects.create_user(
            email='patient-lab@hopital.bi', password='Pass123456!', role='CUSTOMER',
            first_name='Aline', last_name='Ndayishimiye',
        )
        self.category = BusinessCategory.objects.create(name='Hôpital Lab', slug='hopital-lab-p0')
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            name='Clinique Lab Test',
            province='Bujumbura Mairie',
        )
        self.doctor_user = User.objects.create_user(
            email='doc-lab@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Jean', last_name='Bizimana',
        )
        self.specialty = Specialty.objects.create(name='Biologie')
        self.doctor = DoctorProfile.objects.create(
            user=self.doctor_user,
            hospital=self.business,
            medical_license_number='LIC-LAB-1',
            staff_category='DOCTOR',
            consultation_fee=10000,
        )
        self.doctor.specialties.add(self.specialty)

        self.lab_user = User.objects.create_user(
            email='labo@hopital.bi', password='Pass123456!', role='PROFESSIONAL',
            first_name='Lab', last_name='Tech',
        )
        lab_role = BusinessRole.objects.create(
            business=self.business,
            name='Laborantin',
            system_access_level='LAB_ACCESS',
            permissions=['can_manage_lab_results'],
        )
        BusinessEmployee.objects.create(
            business=self.business,
            user=self.lab_user,
            role=lab_role,
            position='LAB_TECHNICIAN',
            is_active=True,
        )

        from hospital.models import HospitalExam, LabResult, Invoice, Prescription
        self.HospitalExam = HospitalExam
        self.LabResult = LabResult
        self.Invoice = Invoice
        self.Prescription = Prescription

        self.exam = HospitalExam.objects.create(
            hospital=self.business,
            name='NFS',
            category='LABORATORY',
            price=25000,
            currency='BIF',
            loinc_code='58410-2',
            is_active=True,
        )

    def test_prescription_exam_creates_lab_request(self):
        self.client.force_authenticate(user=self.doctor_user)
        res = self.client.post('/api/v1/hospital/prescriptions/', {
            'patient': str(self.patient.id),
            'hospital': str(self.business.id),
            'prescription_type': 'EXAM',
            'exam_name': 'NFS',
            'exam_reason': 'Anémie',
            'hospital_exam': str(self.exam.id),
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        labs = self.LabResult.objects.filter(patient=self.patient, hospital=self.business)
        self.assertEqual(labs.count(), 1)
        lab = labs.first()
        self.assertEqual(lab.status, 'REQUESTED')
        self.assertEqual(lab.test_name, 'NFS')
        self.assertEqual(str(lab.hospital_exam_id), str(self.exam.id))
        self.assertTrue(lab.events.filter(action='CREATED_FROM_PRESCRIPTION').exists())

    def test_workflow_validate_invoice_fhir_patient_visibility(self):
        from hospital.lab_workflow import create_lab_from_prescription
        from django.core.files.uploadedfile import SimpleUploadedFile

        rx = self.Prescription.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            hospital=self.business,
            prescription_type='EXAM',
            exam_name='NFS',
            hospital_exam=self.exam,
        )
        lab = create_lab_from_prescription(rx, hospital_exam=self.exam, actor=self.doctor_user)
        self.assertEqual(lab.status, 'REQUESTED')

        self.client.force_authenticate(user=self.lab_user)
        for st in ('SAMPLE_COLLECTED', 'IN_ANALYSIS'):
            r = self.client.post(
                f'/api/v1/hospital/lab-results/{lab.id}/update_status/',
                {'status': st}, format='json',
            )
            self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        r = self.client.post(
            f'/api/v1/hospital/lab-results/{lab.id}/update_status/',
            {
                'status': 'RESULT_AVAILABLE',
                'parameters': [
                    {'name': 'Hb', 'value': '12.1', 'unit': 'g/dL', 'reference': '12-16', 'flag': 'N'},
                ],
            },
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        upload = self.client.post(
            f'/api/v1/hospital/lab-results/{lab.id}/upload-document/',
            {'document': SimpleUploadedFile('cr.pdf', b'%PDF-1.4 lab', content_type='application/pdf')},
            format='multipart',
        )
        self.assertEqual(upload.status_code, status.HTTP_200_OK, upload.data)

        forbid = self.client.post(
            f'/api/v1/hospital/lab-results/{lab.id}/update_status/',
            {'status': 'VALIDATED'}, format='json',
        )
        self.assertEqual(forbid.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.doctor_user)
        ok = self.client.post(
            f'/api/v1/hospital/lab-results/{lab.id}/update_status/',
            {'status': 'VALIDATED'}, format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        lab.refresh_from_db()
        self.assertEqual(lab.status, 'VALIDATED')
        self.assertIsNotNone(lab.invoice_id)
        inv = self.Invoice.objects.get(id=lab.invoice_id)
        self.assertEqual(inv.act_type, 'EXAM')
        self.assertEqual(float(inv.amount), 25000.0)

        fhir = self.client.get(f'/api/v1/hospital/lab-results/{lab.id}/fhir/')
        self.assertEqual(fhir.status_code, status.HTTP_200_OK)
        self.assertEqual(fhir.data['resourceType'], 'Bundle')
        types = {e['resource']['resourceType'] for e in fhir.data['entry']}
        self.assertIn('ServiceRequest', types)
        self.assertIn('DiagnosticReport', types)
        self.assertIn('Observation', types)

        stats = self.client.get(f'/api/v1/hospital/lab-results/stats/?hospital={self.business.id}')
        self.assertEqual(stats.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(stats.data['total'], 1)

        # Patient ne voit pas encore (avant notification)
        self.client.force_authenticate(user=self.patient)
        patient_list = self.client.get('/api/v1/hospital/lab-results/')
        self.assertEqual(patient_list.status_code, status.HTTP_200_OK)
        rows = patient_list.data if isinstance(patient_list.data, list) else patient_list.data.get('results', [])
        self.assertFalse(any(str(row['id']) == str(lab.id) for row in rows))

        # Laborantin notifie → patient voit
        self.client.force_authenticate(user=self.lab_user)
        notified = self.client.post(
            f'/api/v1/hospital/lab-results/{lab.id}/update_status/',
            {'status': 'COMMUNICATED'}, format='json',
        )
        self.assertEqual(notified.status_code, status.HTTP_200_OK, notified.data)

        self.client.force_authenticate(user=self.patient)
        patient_list = self.client.get('/api/v1/hospital/lab-results/')
        self.assertEqual(patient_list.status_code, status.HTTP_200_OK)
        rows = patient_list.data if isinstance(patient_list.data, list) else patient_list.data.get('results', [])
        self.assertTrue(any(str(row['id']) == str(lab.id) for row in rows))
