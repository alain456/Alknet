import uuid
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from businesses.models import BusinessRole, BusinessEmployee
from .models import (
    Specialty, DoctorProfile, Appointment, AppointmentSlot, MedicalService, DoctorSchedule,
    MedicalRecord, LabResult, Invoice, Notification, Prescription, HospitalProfile, ServiceAssignment,
    ServiceCategory
)
from .serializers import (
    SpecialtySerializer, DoctorProfileSerializer, DoctorProfileListSerializer,
    AppointmentSerializer, AppointmentSlotSerializer, MedicalServiceSerializer, DoctorScheduleSerializer,
    MedicalRecordSerializer, LabResultSerializer, InvoiceSerializer,
    NotificationSerializer, PrescriptionSerializer,
    HospitalProfileSerializer, HospitalProfileListSerializer, ServiceAssignmentSerializer,
    ServiceCategorySerializer
)
from .permissions import IsMedicalRecordViewer, IsLabTechnician, IsCashier, IsHospitalAdmin

User = get_user_model()

class SpecialtyViewSet(viewsets.ModelViewSet):
    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


# ---------------------------------------------------------------------------
# 01.1 — PROFIL HÔPITAL + GÉOLOCALISATION
# ---------------------------------------------------------------------------

class HospitalProfileViewSet(viewsets.ModelViewSet):
    """
    CRUD pour les fiches hôpital.
    Actions supplémentaires :
      - GET /hospitals/nearby/?lat=X&lng=Y&radius=10  → Hôpitaux dans le rayon (km)
      - GET /hospitals/{id}/services/               → Services de l'hôpital
      - GET /hospitals/{id}/doctors/                → Médecins de l'hôpital
    """
    queryset = HospitalProfile.objects.select_related('business').all()
    serializer_class = HospitalProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['business__name', 'acronym', 'level', 'hospital_type']

    def get_serializer_class(self):
        if self.action == 'list':
            return HospitalProfileListSerializer
        return HospitalProfileSerializer

    def get_queryset(self):
        queryset = HospitalProfile.objects.select_related('business').all()
        # Filtres
        hospital_type = self.request.query_params.get('hospital_type')
        level = self.request.query_params.get('level')
        emergency = self.request.query_params.get('emergency')
        telemedicine = self.request.query_params.get('telemedicine')
        province = self.request.query_params.get('province')

        if hospital_type:
            queryset = queryset.filter(hospital_type=hospital_type)
        if level:
            queryset = queryset.filter(level=level)
        if emergency is not None:
            queryset = queryset.filter(emergency_available=emergency.lower() in ['true', '1'])
        if telemedicine is not None:
            queryset = queryset.filter(telemedicine_unit_available=telemedicine.lower() in ['true', '1'])
        if province:
            queryset = queryset.filter(business__province__icontains=province)
        return queryset

    @action(detail=False, methods=['get'], url_path='nearby')
    def nearby(self, request):
        """
        Retourne les hôpitaux dans un rayon donné autour d'un point GPS.
        Paramètres : lat (float), lng (float), radius (float, km, défaut=20)
        Algorithme : distance Haversine approxée — précis pour distances courtes.
        """
        import math

        try:
            user_lat = float(request.query_params.get('lat', 0))
            user_lng = float(request.query_params.get('lng', 0))
            radius_km = float(request.query_params.get('radius', 20))
        except (ValueError, TypeError):
            return Response(
                {'error': 'Paramètres lat, lng et radius doivent être des nombres'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user_lat or not user_lng:
            return Response(
                {'error': 'Les paramètres lat et lng sont requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Filtrer les hôpitaux ayant des coordonnées GPS
        hospitals = HospitalProfile.objects.select_related('business').filter(
            business__latitude__isnull=False,
            business__longitude__isnull=False,
        )

        def haversine_distance(lat1, lng1, lat2, lng2):
            """Distance en km entre deux points GPS (formule Haversine)."""
            R = 6371  # Rayon de la Terre en km
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlambda = math.radians(lng2 - lng1)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        results = []
        for h in hospitals:
            dist = haversine_distance(
                user_lat, user_lng,
                h.business.latitude, h.business.longitude
            )
            if dist <= radius_km:
                results.append((dist, h))

        # Tri par distance croissante
        results.sort(key=lambda x: x[0])

        serializer = HospitalProfileListSerializer(
            [h for _, h in results], many=True, context={'request': request}
        )
        data = serializer.data
        # Injection de la distance dans chaque objet
        for i, (dist, _) in enumerate(results):
            data[i]['distance_km'] = round(dist, 2)

        return Response(data)

    @action(detail=True, methods=['get'], url_path='services')
    def services(self, request, pk=None):
        """Liste des services médicaux actifs d'un hôpital."""
        hospital_profile = self.get_object()
        services = MedicalService.objects.filter(
            hospital=hospital_profile.business, is_active=True
        ).order_by('display_order', 'category', 'name')
        serializer = MedicalServiceSerializer(services, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='doctors')
    def doctors(self, request, pk=None):
        """Liste des médecins actifs rattachés à un hôpital."""
        hospital_profile = self.get_object()
        doctors = DoctorProfile.objects.filter(
            hospital=hospital_profile.business, is_active=True
        ).select_related('user').prefetch_related('specialties')
        serializer = DoctorProfileListSerializer(doctors, many=True, context={'request': request})
        return Response(serializer.data)


class DoctorProfileViewSet(viewsets.ModelViewSet):
    queryset = DoctorProfile.objects.all()
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__first_name', 'user__last_name', 'bio', 'medical_license_number']

    def get_serializer_class(self):
        return DoctorProfileSerializer

    def get_queryset(self):
        queryset = DoctorProfile.objects.select_related('user', 'hospital').prefetch_related('specialties')
        hospital_id = self.request.query_params.get('hospital')
        is_telemed = self.request.query_params.get('is_available_for_telemedicine')
        is_active = self.request.query_params.get('is_active')
        is_diaspora = self.request.query_params.get('is_diaspora')
        is_tele_expertise = self.request.query_params.get('is_available_for_tele_expertise')
        accepting = self.request.query_params.get('is_accepting_new_patients')

        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if is_telemed is not None:
            queryset = queryset.filter(
                is_available_for_telemedicine=is_telemed.lower() in ['true', '1']
            )
        if is_active is not None:
            active_bool = is_active.lower() in ['true', '1']
            queryset = queryset.filter(is_active=active_bool, user__is_active=active_bool)
        else:
            queryset = queryset.filter(is_active=True, user__is_active=True)

        if is_diaspora is not None:
            queryset = queryset.filter(
                is_diaspora=is_diaspora.lower() in ['true', '1']
            )
        if is_tele_expertise is not None:
            queryset = queryset.filter(
                is_available_for_tele_expertise=is_tele_expertise.lower() in ['true', '1']
            )
        if accepting is not None:
            queryset = queryset.filter(
                is_accepting_new_patients=accepting.lower() in ['true', '1']
            )
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
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        data = request.data.copy()

        # Injection automatique de l'ID utilisateur si absent
        if 'user' not in data:
            data['user'] = instance.user.id

        # Nettoyage et sécurisation du consultation_fee
        if 'consultation_fee' in data:
            try:
                data['consultation_fee'] = float(data['consultation_fee']) if data['consultation_fee'] != '' else 0.0
            except (ValueError, TypeError):
                data['consultation_fee'] = 0.0

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

class AllowAnyReadOnlyOrAuthenticatedCreate(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


class AppointmentSlotViewSet(viewsets.ModelViewSet):
    """
    Gestion des Créneaux / Sessions de Rendez-vous créés par l'Admin.
    Permet la définition des quotas max_patients et la réservation avec ordre de passage.
    """
    queryset = AppointmentSlot.objects.all()
    serializer_class = AppointmentSlotSerializer
    permission_classes = [AllowAnyReadOnlyOrAuthenticatedCreate]

    def get_queryset(self):
        queryset = AppointmentSlot.objects.all()
        hospital_id = self.request.query_params.get('hospital')
        doctor_id = self.request.query_params.get('doctor')
        status_param = self.request.query_params.get('status')
        upcoming = self.request.query_params.get('upcoming')
        is_active_param = self.request.query_params.get('is_active')

        user = self.request.user
        
        # If explicitly requested, filter by is_active
        if is_active_param is not None:
            is_active_bool = is_active_param.lower() in ['true', '1', 'yes']
            queryset = queryset.filter(is_active=is_active_bool)
        elif not user.is_authenticated or (hasattr(user, 'role') and user.role not in ['SUPER_ADMIN', 'BUSINESS_OWNER'] and not BusinessEmployee.objects.filter(user=user.id).exists()):
            # By default, public users and normal patients only see active slots
            queryset = queryset.filter(is_active=True)

        if user.is_authenticated and hasattr(user, 'doctor_profile') and not hospital_id and user.role not in ['SUPER_ADMIN', 'BUSINESS_OWNER']:
            queryset = queryset.filter(doctor=user.doctor_profile)

        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if upcoming and upcoming.lower() in ['true', '1']:
            queryset = queryset.filter(slot_date__gte=timezone.now().date())

        return queryset.order_by('slot_date', 'start_time')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)


class AllowAnyCreateOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action == 'create':
            return True
        return bool(request.user and request.user.is_authenticated)


class AppointmentViewSet(viewsets.ModelViewSet):
    """Workflow complet des rendez-vous — Module 01.5 avec isolation Multi-Tenant SaaS"""
    serializer_class = AppointmentSerializer
    permission_classes = [AllowAnyCreateOnly]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Appointment.objects.none()

        hospital_id = self.request.query_params.get('hospital')

        if user.role == 'SUPER_ADMIN':
            queryset = Appointment.objects.all()
        elif user.role == 'BUSINESS_OWNER':
            queryset = Appointment.objects.filter(hospital__owner=user)
        elif BusinessEmployee.objects.filter(user=user).exists():
            if hasattr(user, 'doctor_profile') and not hospital_id:
                queryset = Appointment.objects.filter(doctor=user.doctor_profile)
            else:
                queryset = Appointment.objects.filter(hospital__employees__user=user)
        elif hasattr(user, 'doctor_profile'):
            queryset = Appointment.objects.filter(doctor=user.doctor_profile)
        else:
            queryset = Appointment.objects.filter(patient=user)

        appt_status = self.request.query_params.get('status')
        consultation_type = self.request.query_params.get('consultation_type')
        upcoming = self.request.query_params.get('upcoming')  # ?upcoming=true
        slot_id = self.request.query_params.get('slot')

        if appt_status:
            queryset = queryset.filter(status=appt_status)
        if consultation_type:
            queryset = queryset.filter(consultation_type=consultation_type)
        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if slot_id:
            queryset = queryset.filter(slot_id=slot_id)
        if upcoming and upcoming.lower() in ['true', '1']:
            queryset = queryset.filter(
                appointment_date__gte=timezone.now(),
                status__in=['PENDING', 'CONFIRMED']
            ).order_by('appointment_date')

        return queryset

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from datetime import datetime

        user = self.request.user
        data = self.request.data
        slot_id = data.get('slot')

        slot = None
        queue_number = None

        if slot_id:
            try:
                slot = AppointmentSlot.objects.get(id=slot_id)
                if slot.remaining_slots <= 0 or slot.status == 'FULL':
                    raise ValidationError({"slot": "Ce créneau de rendez-vous est déjà complet."})
                queue_number = slot.booked_count + 1
            except AppointmentSlot.DoesNotExist:
                raise ValidationError({"slot": "Créneau de rendez-vous non trouvé."})

        if user and user.is_authenticated:
            patient_user = user
        else:
            email = data.get('patient_email') or data.get('email')
            name = data.get('patient_name') or 'Patient'
            phone = data.get('patient_phone') or ''

            if not email:
                email = f"guest_{uuid.uuid4().hex[:8]}@isokohub.com"

            parts = name.strip().split()
            first_name = parts[0] if parts else 'Patient'
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

            patient_user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'phone_number': phone,
                    'role': 'CUSTOMER',
                    'is_active': True
                }
            )

        kwargs = {'patient': patient_user}
        if slot:
            kwargs['slot'] = slot
            kwargs['queue_number'] = queue_number
            kwargs['doctor'] = slot.doctor
            kwargs['hospital'] = slot.hospital
            if 'appointment_date' not in data or not data.get('appointment_date'):
                dt = datetime.combine(slot.slot_date, slot.start_time)
                kwargs['appointment_date'] = timezone.make_aware(dt) if timezone.is_naive(dt) else dt

        appointment = serializer.save(**kwargs)

        if slot and slot.booked_count >= slot.max_patients:
            slot.status = 'FULL'
            slot.save()

    # -----------------------------------------------------------------------
    # Actions de workflow (Module 01.5 — Sections 5 & 13)
    # -----------------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """
        Confirme un rendez-vous en attente.
        Transition valide : PENDING → CONFIRMED
        """
        appointment = self.get_object()
        if not appointment.can_transition_to('CONFIRMED'):
            return Response(
                {'error': f'Impossible de confirmer un RDV avec le statut "{appointment.get_status_display()}"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.confirm()
        # Notification au patient
        Notification.objects.create(
            user=appointment.patient,
            notification_type='APPOINTMENT_REMINDER',
            title='Rendez-vous confirmé',
            message=(
                f'Votre rendez-vous du {appointment.appointment_date.strftime("%d/%m/%Y à %H:%M")} '
                f'avec {appointment.doctor.user.get_full_name()} a été confirmé.'
            ),
            appointment=appointment
        )
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Marque un rendez-vous comme terminé.
        Transition valide : IN_PROGRESS → COMPLETED
        Body optionnel : {"notes": "..."}
        """
        appointment = self.get_object()
        notes = request.data.get('notes')
        if not appointment.can_transition_to('COMPLETED'):
            return Response(
                {'error': f'Impossible de terminer un RDV avec le statut "{appointment.get_status_display()}"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.complete(notes=notes)
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Annule un rendez-vous.
        Transitions valides : PENDING | CONFIRMED | RESCHEDULED → CANCELLED
        Body optionnel : {"reason": "..."}
        """
        appointment = self.get_object()
        reason = request.data.get('reason')
        if not appointment.can_transition_to('CANCELLED'):
            return Response(
                {'error': f'Impossible d\'annuler un RDV avec le statut "{appointment.get_status_display()}"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.cancel(reason=reason, cancelled_by=request.user)
        # Notification au patient si annulé par un autre
        if appointment.patient != request.user:
            Notification.objects.create(
                user=appointment.patient,
                notification_type='GENERAL',
                title='Rendez-vous annulé',
                message=f'Votre rendez-vous du {appointment.appointment_date.strftime("%d/%m/%Y à %H:%M")} a été annulé.',
                appointment=appointment
            )
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        """
        Reprogramme un rendez-vous (crée un nouveau RDV lié).
        Transition valide : CONFIRMED → RESCHEDULED
        Body requis : {"new_date": "2026-09-01T10:00:00Z", "reason": "..."}
        """
        appointment = self.get_object()
        new_date = request.data.get('new_date')
        reason = request.data.get('reason', '')

        if not appointment.can_transition_to('RESCHEDULED'):
            return Response(
                {'error': f'Impossible de reprogrammer un RDV avec le statut "{appointment.get_status_display()}"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not new_date:
            return Response(
                {'error': 'Le paramètre new_date est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Créer le nouveau RDV
            new_appointment = Appointment.objects.create(
                patient=appointment.patient,
                doctor=appointment.doctor,
                hospital=appointment.hospital,
                appointment_date=new_date,
                consultation_type=appointment.consultation_type,
                reason=appointment.reason,
                status='PENDING',
            )
            # Marquer l'ancien comme reprogrammé
            appointment.status = 'RESCHEDULED'
            appointment.rescheduled_to = new_appointment
            appointment.cancellation_reason = reason
            appointment.save(update_fields=['status', 'rescheduled_to', 'cancellation_reason', 'updated_at'])

        # Notification au patient
        Notification.objects.create(
            user=appointment.patient,
            notification_type='APPOINTMENT_REMINDER',
            title='Rendez-vous reprogrammé',
            message=(
                f'Votre rendez-vous a été reprogrammé au '
                f'{new_appointment.appointment_date.strftime("%d/%m/%Y à %H:%M")}. '
                f'Motif : {reason}'
            ),
            appointment=new_appointment
        )
        return Response({
            'old_appointment': AppointmentSerializer(appointment).data,
            'new_appointment': AppointmentSerializer(new_appointment).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """
        Transition de statut générique avec validation du workflow.
        Body requis : {"status": "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | ...}
        """
        appointment = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response(
                {'error': 'Le champ status est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not appointment.can_transition_to(new_status):
            valid = appointment.VALID_TRANSITIONS.get(appointment.status, [])
            return Response(
                {
                    'error': f'Transition invalide: {appointment.status} → {new_status}',
                    'valid_transitions': valid,
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.status = new_status
        appointment.save(update_fields=['status', 'updated_at'])
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'])
    def set_telemedicine_link(self, request, pk=None):
        """
        Définit le lien de téléconsultation pour un RDV.
        Body requis : {"telemedicine_link": "https://...", "room_id": "..."}
        """
        appointment = self.get_object()
        link = request.data.get('telemedicine_link')
        room_id = request.data.get('room_id', '')

        if not link:
            return Response(
                {'error': 'Le champ telemedicine_link est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.telemedicine_link = link
        appointment.telemedicine_room_id = room_id
        appointment.save(update_fields=['telemedicine_link', 'telemedicine_room_id', 'updated_at'])

        # Notification au patient avec le lien
        Notification.objects.create(
            user=appointment.patient,
            notification_type='APPOINTMENT_REMINDER',
            title='Lien de téléconsultation disponible',
            message=f'Votre lien de téléconsultation est prêt : {link}',
            appointment=appointment
        )
        return Response(AppointmentSerializer(appointment).data)


class ServiceCategoryViewSet(viewsets.ModelViewSet):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    def get_queryset(self):
        queryset = super().get_queryset()
        hospital_id = self.request.query_params.get('hospital', None)
        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        return queryset


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
    Seuls le patient concerné, le médecin assigné, ou le personnel autorisé de cet hôpital ont accès.
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsMedicalRecordViewer]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return MedicalRecord.objects.all()
        if hasattr(user, 'role') and user.role == 'CUSTOMER':
            return MedicalRecord.objects.filter(patient=user)
        if user.role == 'BUSINESS_OWNER':
            return MedicalRecord.objects.filter(hospital__owner=user)
        return MedicalRecord.objects.filter(hospital__employees__user=user)

class LabResultViewSet(viewsets.ModelViewSet):
    """
    Accès Laboratoire:
    Enregistrement et validation des résultats d'examens avec workflow de sécurité élevée et isolation multi-tenant.
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
        if user.role == 'BUSINESS_OWNER':
            return LabResult.objects.filter(hospital__owner=user)
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
    Multi-tenant isolation stricte.
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return Prescription.objects.all()
        elif user.role == 'BUSINESS_OWNER':
            return Prescription.objects.filter(hospital__owner=user)
        elif BusinessEmployee.objects.filter(user=user).exists():
            return Prescription.objects.filter(hospital__employees__user=user)
        elif user.role == 'PROFESSIONAL':
            return Prescription.objects.filter(doctor__user=user)
        elif user.role == 'CUSTOMER':
            return Prescription.objects.filter(patient=user)
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
    Isolation stricte par établissement de santé / hôpital.
    """
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsCashier]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN':
            return Invoice.objects.all()
        if user.role == 'CUSTOMER':
            return Invoice.objects.filter(patient=user)
        if user.role == 'BUSINESS_OWNER':
            return Invoice.objects.filter(hospital__owner=user)
        if user.role == 'CUSTOMER':
            return Invoice.objects.filter(patient=user)
        return Invoice.objects.filter(hospital__employees__user=user)


class ServiceAssignmentViewSet(viewsets.ModelViewSet):
    """
    Gestion des affectations du personnel aux services hospitaliers.
    Permet à l'Administrateur d'Hôpital d'affecter le personnel (Médecin, Infirmier, Laborantin, Caissier) à des services précis.
    """
    serializer_class = ServiceAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        hospital_id = self.request.query_params.get('hospital')
        qs = ServiceAssignment.objects.all()

        if hospital_id:
            qs = qs.filter(hospital_id=hospital_id)

        if user.role == 'SUPER_ADMIN':
            return qs
        if user.role == 'BUSINESS_OWNER':
            return qs.filter(hospital__owner=user)
        
        return qs.filter(hospital__employees__user=user)

