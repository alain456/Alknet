from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Specialty, DoctorProfile, Appointment, MedicalService, DoctorSchedule, MedicalRecord, LabResult, Invoice
from .serializers import (
    SpecialtySerializer, DoctorProfileSerializer, AppointmentSerializer, 
    MedicalServiceSerializer, DoctorScheduleSerializer, MedicalRecordSerializer, 
    LabResultSerializer, InvoiceSerializer
)
from .permissions import IsMedicalRecordViewer, IsLabTechnician, IsCashier, IsHospitalAdmin

User = get_user_model()

class SpecialtyViewSet(viewsets.ModelViewSet):
    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

class DoctorProfileViewSet(viewsets.ModelViewSet):
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__first_name', 'user__last_name', 'bio']

    def get_queryset(self):
        queryset = DoctorProfile.objects.all()
        hospital_id = self.request.query_params.get('hospital', None)
        is_telemed = self.request.query_params.get('is_available_for_telemedicine', None)
        if hospital_id is not None:
            queryset = queryset.filter(hospital_id=hospital_id)
        if is_telemed is not None:
            is_telemed_bool = str(is_telemed).lower() in ['true', '1', 't', 'y', 'yes']
            queryset = queryset.filter(is_available_for_telemedicine=is_telemed_bool)
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Permet de créer le User et le DoctorProfile en même temps.
        Requis dans request.data : email, first_name, last_name, password, hospital_id, medical_license_number
        """
        data = request.data
        if 'email' in data and 'password' in data:
            # Création de l'utilisateur
            user, created = User.objects.get_or_create(
                email=data['email'],
                defaults={
                    'first_name': data.get('first_name', ''),
                    'last_name': data.get('last_name', ''),
                    'role': 'PROFESSIONAL'
                }
            )
            if created:
                user.set_password(data['password'])
                user.save()
            
            # Injection de l'ID utilisateur pour le serializer
            data_copy = data.copy()
            data_copy['user'] = user.id
            
            serializer = self.get_serializer(data=data_copy)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        return super().create(request, *args, **kwargs)

class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'doctor_profile'):
            queryset = Appointment.objects.filter(doctor=user.doctor_profile)
        else:
            queryset = Appointment.objects.filter(patient=user)
            
        status = self.request.query_params.get('status', None)
        consultation_type = self.request.query_params.get('consultation_type', None)
        
        if status:
            queryset = queryset.filter(status=status)
        if consultation_type:
            queryset = queryset.filter(consultation_type=consultation_type)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        appointment.status = 'CANCELLED'
        appointment.save()
        return Response({'status': 'appointment cancelled'})

class MedicalServiceViewSet(viewsets.ModelViewSet):
    queryset = MedicalService.objects.all()
    serializer_class = MedicalServiceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_queryset(self):
        queryset = super().get_queryset()
        hospital_id = self.request.query_params.get('hospital', None)
        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        return queryset

class DoctorScheduleViewSet(viewsets.ModelViewSet):
    queryset = DoctorSchedule.objects.all()
    serializer_class = DoctorScheduleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        doctor_id = self.request.query_params.get('doctor', None)
        hospital_id = self.request.query_params.get('hospital', None)
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        return queryset

class MedicalRecordViewSet(viewsets.ModelViewSet):
    """
    Secret Médical & Téléconsultation:
    Seuls le patient concerné, le médecin assigné, ou le spécialiste téléconsultation ont accès.
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsMedicalRecordViewer]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return MedicalRecord.objects.all()
        if hasattr(user, 'role') and user.role == 'CUSTOMER':
            return MedicalRecord.objects.filter(patient=user)
        return MedicalRecord.objects.filter(hospital__employees__user=user)

class LabResultViewSet(viewsets.ModelViewSet):
    """
    Accès Laboratoire:
    Enregistrement et validation des résultats d'examens.
    """
    serializer_class = LabResultSerializer
    permission_classes = [permissions.IsAuthenticated, IsLabTechnician]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return LabResult.objects.all()
        if user.role == 'CUSTOMER':
            return LabResult.objects.filter(patient=user)
        return LabResult.objects.filter(hospital__employees__user=user)

class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Accès Caissier & Facturation:
    Sans accès aux données médicales cliniques.
    """
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsCashier]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return Invoice.objects.all()
        if user.role == 'CUSTOMER':
            return Invoice.objects.filter(patient=user)
        return Invoice.objects.filter(hospital__employees__user=user)
