import uuid
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from businesses.models import Business
from business_categories.models import BusinessCategory
from hospital.models import DoctorProfile, Specialty, Appointment, Notification, AppointmentSlot

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
