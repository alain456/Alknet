from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SpecialtyViewSet, DoctorProfileViewSet, AppointmentViewSet,
    MedicalServiceViewSet, DoctorScheduleViewSet, MedicalRecordViewSet,
    LabResultViewSet, InvoiceViewSet, NotificationViewSet, PrescriptionViewSet,
    HospitalProfileViewSet
)

router = DefaultRouter()
router.register(r'profiles', HospitalProfileViewSet, basename='hospital-profile')
router.register(r'specialties', SpecialtyViewSet)
router.register(r'doctors', DoctorProfileViewSet, basename='doctor')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'services', MedicalServiceViewSet, basename='medical-service')
router.register(r'schedules', DoctorScheduleViewSet, basename='doctor-schedule')
router.register(r'medical-records', MedicalRecordViewSet, basename='medical-record')
router.register(r'lab-results', LabResultViewSet, basename='lab-result')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')

urlpatterns = [
    path('', include(router.urls)),
]
