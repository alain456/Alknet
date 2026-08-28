from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction
from businesses.models import BusinessRole, BusinessEmployee
from .models import Specialty, DoctorProfile, Appointment, MedicalService, DoctorSchedule, MedicalRecord, LabResult, Invoice, Notification, Prescription
from .serializers import (
    SpecialtySerializer, DoctorProfileSerializer, AppointmentSerializer, 
    MedicalServiceSerializer, DoctorScheduleSerializer, MedicalRecordSerializer, 
    LabResultSerializer, InvoiceSerializer, NotificationSerializer, PrescriptionSerializer
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
    queryset = DoctorProfile.objects.all()
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
        Requis dans request.data : email, first_name, last_name, password, hospital, medical_license_number
        Optionnel : service_ids (liste des services à attribuer), role_id (Rôle BusinessRole à attribuer)
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
            doctor_profile = serializer.instance
            
            # Attribution des services si fournis
            if 'service_ids' in data:
                doctor_profile.services.set(data['service_ids'])
            
            # Attribution du rôle BusinessRole et création de l'employé
            hospital_obj = doctor_profile.hospital
            if hospital_obj:
                role_id = data.get('role_id')
                role_obj = None
                if role_id:
                    role_obj = BusinessRole.objects.filter(id=role_id, business=hospital_obj).first()
                
                BusinessEmployee.objects.update_or_create(
                    user=user,
                    business=hospital_obj,
                    defaults={'role': role_obj, 'position': 'Médecin'}
                )
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data.copy()

        # Mise à jour des informations de l'utilisateur associé
        user = instance.user
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data and data['email']:
            user.email = data['email']
        user.save()

        # Mise à jour du profil médecin via le serializer
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Mise à jour des services attribués
        if 'service_ids' in data:
            instance.services.set(data['service_ids'])

        # Mise à jour du rôle RBAC BusinessRole
        hospital_obj = instance.hospital
        if hospital_obj and 'role_id' in data:
            role_id = data.get('role_id')
            role_obj = None
            if role_id:
                role_obj = BusinessRole.objects.filter(id=role_id, business=hospital_obj).first()
            
            BusinessEmployee.objects.update_or_create(
                user=user,
                business=hospital_obj,
                defaults={'role': role_obj, 'position': 'Médecin'}
            )

        return Response(serializer.data)

    @action(detail=True, methods=['post', 'put'])
    def assign_services(self, request, pk=None):
        """
        Attribuer ou mettre à jour les services d'un médecin.
        POST/PUT body: {"service_ids": [id1, id2, ...]}
        """
        doctor = self.get_object()
        service_ids = request.data.get('service_ids', [])
        
        if not isinstance(service_ids, list):
            return Response(
                {'error': 'service_ids doit être une liste'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        doctor.services.set(service_ids)
        serializer = self.get_serializer(doctor)
        return Response(serializer.data)

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
    search_fields = ['name', 'description']

    def get_queryset(self):
        queryset = super().get_queryset()
        hospital_id = self.request.query_params.get('hospital', None)
        category = self.request.query_params.get('category', None)
        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if category:
            queryset = queryset.filter(category=category)
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

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """
        Créer plusieurs horaires pour un médecin en une seule requête.
        Body: {"doctor_id": uuid, "hospital_id": uuid, "schedules": [{"day_of_week": 0, "start_time": "08:00", "end_time": "17:00", "is_available": true}, ...]}
        """
        doctor_id = request.data.get('doctor_id')
        hospital_id = request.data.get('hospital_id')
        schedules_data = request.data.get('schedules', [])

        if not doctor_id or not hospital_id or not schedules_data:
            return Response(
                {'error': 'doctor_id, hospital_id et schedules sont requis'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .models import DoctorProfile, Business
            doctor = DoctorProfile.objects.get(id=doctor_id)
            hospital = Business.objects.get(id=hospital_id)
        except (DoctorProfile.DoesNotExist, Business.DoesNotExist):
            return Response(
                {'error': 'Médecin ou hôpital introuvable'}, 
                status=status.HTTP_404_NOT_FOUND
            )

        created_schedules = []
        for schedule_data in schedules_data:
            schedule = DoctorSchedule.objects.create(
                doctor=doctor,
                hospital=hospital,
                day_of_week=schedule_data.get('day_of_week'),
                start_time=schedule_data.get('start_time'),
                end_time=schedule_data.get('end_time'),
                is_available=schedule_data.get('is_available', True)
            )
            created_schedules.append(schedule)

        serializer = DoctorScheduleSerializer(created_schedules, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
    Enregistrement et validation des résultats d'examens avec workflow de sécurité élevée.
    """
    serializer_class = LabResultSerializer
    permission_classes = [permissions.IsAuthenticated, IsLabTechnician]
    filterset_fields = ['hospital', 'patient', 'status']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return LabResult.objects.all()
        if user.role == 'CUSTOMER':
            # Les patients ne voient que les résultats validés ou communiqués
            return LabResult.objects.filter(patient=user, status__in=['VALIDATED', 'COMMUNICATED'])
        return LabResult.objects.filter(hospital__employees__user=user)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """
        Mettre à jour le statut d'un résultat de laboratoire.
        Workflow: REQUESTED → SAMPLE_COLLECTED → IN_ANALYSIS → RESULT_AVAILABLE → VALIDATED → COMMUNICATED
        Body: {"status": "SAMPLE_COLLECTED" | "IN_ANALYSIS" | "RESULT_AVAILABLE" | "VALIDATED" | "COMMUNICATED"}
        """
        from django.utils import timezone
        
        lab_result = self.get_object()
        new_status = request.data.get('status')
        
        valid_statuses = ['SAMPLE_COLLECTED', 'IN_ANALYSIS', 'RESULT_AVAILABLE', 'VALIDATED', 'COMMUNICATED']
        
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Statut invalide. Valeurs acceptées: {", ".join(valid_statuses)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        lab_result.status = new_status
        
        # Enregistrer qui a validé et quand
        if new_status == 'VALIDATED':
            if hasattr(request.user, 'doctor_profile'):
                lab_result.validated_by = request.user.doctor_profile
            lab_result.validation_date = timezone.now()
        
        # Enregistrer la date de communication et envoyer notification
        if new_status == 'COMMUNICATED':
            lab_result.communication_date = timezone.now()
            
            # Créer une notification pour le patient
            from .models import Notification
            Notification.objects.create(
                user=lab_result.patient,
                notification_type='LAB_RESULT',
                title='Résultat de laboratoire disponible',
                message=f'Votre résultat d\'examen "{lab_result.test_name}" est maintenant disponible. Veuillez consulter votre espace patient.',
                lab_result=lab_result
            )
        
        lab_result.save()
        
        serializer = self.get_serializer(lab_result)
        return Response(serializer.data)

class NotificationViewSet(viewsets.ModelViewSet):
    """
    Système de notifications pour les patients.
    Les utilisateurs ne voient que leurs propres notifications.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return Notification.objects.all()
        # Chaque utilisateur voit uniquement ses propres notifications
        return Notification.objects.filter(user=user)

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """
        Marquer une notification comme lue.
        """
        from django.utils import timezone
        
        notification = self.get_object()
        
        # Vérifier que l'utilisateur est bien le destinataire
        if notification.user != request.user:
            return Response(
                {'error': 'Vous ne pouvez pas marquer cette notification comme lue'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """
        Marquer toutes les notifications de l'utilisateur comme lues.
        """
        from django.utils import timezone
        
        notifications = self.get_queryset().filter(is_read=False)
        notifications.update(is_read=True, read_at=timezone.now())
        
        return Response({'message': 'Toutes les notifications ont été marquées comme lues'})

class PrescriptionViewSet(viewsets.ModelViewSet):
    """
    Gestion des prescriptions médicales et examens.
    Accessible par les médecins pour prescrire et par les patients pour voir leurs prescriptions.
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'PROFESSIONAL':
            # Le médecin voit ses prescriptions
            return Prescription.objects.filter(doctor__user=user)
        elif user.role == 'CUSTOMER':
            # Le patient voit ses prescriptions
            return Prescription.objects.filter(patient=user)
        elif user.role in ['BUSINESS_OWNER', 'SUPER_ADMIN']:
            # L'admin voit toutes les prescriptions de son hôpital
            return Prescription.objects.all()
        return Prescription.objects.none()

    def perform_create(self, serializer):
        # Si c'est un médecin, il est automatiquement le prescripteur
        if self.request.user.role == 'PROFESSIONAL':
            from .models import DoctorProfile
            try:
                doctor = DoctorProfile.objects.get(user=self.request.user)
                serializer.save(doctor=doctor, patient=self.request.user)
            except DoctorProfile.DoesNotExist:
                serializer.save()
        else:
            serializer.save()

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
