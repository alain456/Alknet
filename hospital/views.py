import uuid
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from datetime import timedelta
from businesses.models import BusinessRole, BusinessEmployee, Business
from businesses.tenant import filter_queryset_by_hospital_tenant, get_user_tenant_business
from .models import (
    Specialty, DoctorProfile, Appointment, AppointmentSlot, MedicalService, DoctorSchedule,
    MedicalRecord, LabResult, Invoice, Notification, Prescription, HospitalProfile, ServiceAssignment,
    ServiceCategory, HospitalExam
)
from .serializers import (
    SpecialtySerializer, DoctorProfileSerializer, DoctorProfileListSerializer,
    AppointmentSerializer, AppointmentListSerializer, AppointmentSlotSerializer, MedicalServiceSerializer, DoctorScheduleSerializer,
    MedicalRecordSerializer, LabResultSerializer, InvoiceSerializer,
    NotificationSerializer, PrescriptionSerializer,
    HospitalProfileSerializer, HospitalProfileListSerializer, ServiceAssignmentSerializer,
    ServiceCategorySerializer, HospitalExamSerializer
)
from .permissions import (
    IsMedicalRecordViewer, IsLabTechnician, IsCashier, IsHospitalAdmin,
    user_is_lab_technician, user_can_view_lab_results,
)
from .appointment_workflow import (
    validate_slot_for_booking, notify_appointment_booked,
    notify_appointment_confirmed, notify_appointment_rejected,
    notify_appointment_cancelled, notify_appointment_rescheduled,
    notify_anticipation_response,
    generate_appointment_reference, user_can_manage_hospital_appointments,
    user_can_operate_clinical_workflow, user_can_start_consultation,
    user_can_check_in_appointment, user_can_view_appointment_history,
    log_appointment_event, log_slot_action, generate_monthly_slots,
    generate_monthly_slots_for_hospital,
    get_hospital_code, get_reference_prefix, preview_next_appointment_reference,
    user_is_receptionist, notify_appointment_check_in,
    APPOINTMENT_MESSAGE_PLACEHOLDERS, DEFAULT_BOOKING_ACK_TEMPLATE,
    get_booking_ack_template,
)
from accounts.services import log_audit_event
from accounts.models import AuditLog
from accounts.serializers import AuditLogSerializer

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
        from businesses.subscription import (
            ACTIVE_SUBSCRIPTION_STATUSES,
            business_has_active_subscription,
        )
        from businesses.tenant import get_user_tenant_business
        from django.utils import timezone as dj_tz

        queryset = HospitalProfile.objects.select_related('business').all()
        # Catalogue public : masquer sans abonnement SaaS actif
        if self.action in ('list', 'nearby'):
            queryset = queryset.filter(
                business__subscription__status__in=ACTIVE_SUBSCRIPTION_STATUSES,
                business__subscription__ends_at__gte=dj_tz.now(),
            )
        elif self.action in ('retrieve', 'services', 'doctors'):
            user = self.request.user
            tenant = get_user_tenant_business(user) if user and user.is_authenticated else None
            if not tenant or not business_has_active_subscription(tenant):
                # Visiteur / abo inactif : uniquement les hôpitaux avec abo actif
                # (le tenant bloqué voit encore sa fiche via filtre ci-dessous)
                if tenant:
                    queryset = queryset.filter(business_id=tenant.id)
                else:
                    queryset = queryset.filter(
                        business__subscription__status__in=ACTIVE_SUBSCRIPTION_STATUSES,
                        business__subscription__ends_at__gte=dj_tz.now(),
                    )
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

        # Filtrer les hôpitaux ayant des coordonnées GPS + abo actif
        from businesses.subscription import ACTIVE_SUBSCRIPTION_STATUSES
        from django.utils import timezone as dj_tz

        hospitals = HospitalProfile.objects.select_related('business').filter(
            business__latitude__isnull=False,
            business__longitude__isnull=False,
            business__subscription__status__in=ACTIVE_SUBSCRIPTION_STATUSES,
            business__subscription__ends_at__gte=dj_tz.now(),
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
        """Liste des médecins actifs rattachés à un hôpital (annuaire public filtré)."""
        hospital_profile = self.get_object()
        doctors = DoctorProfile.objects.filter(
            hospital=hospital_profile.business, is_active=True
        ).select_related('user', 'user__profile').prefetch_related('specialties', 'services')
        # Côté client : jamais infirmiers, caissiers, labo, agents d'accueil
        if not request.user.is_authenticated or request.query_params.get('public', '').lower() in ('true', '1'):
            doctors = DoctorProfileViewSet._filter_public_directory(doctors)
        serializer = DoctorProfileListSerializer(doctors, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get', 'patch'], url_path='reference-settings')
    def reference_settings(self, request):
        """
        Configuration dynamique des numéros de suivi RDV (admin hôpital).
        Format : {prefix}-{sigle}-{année}-{séquence} ex: RDV-BAHO-2026-000128
        """
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucun hôpital associé.'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role == 'SUPER_ADMIN':
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        profile, _ = HospitalProfile.objects.get_or_create(
            business=business,
            defaults={'hospital_type': 'PRIVATE', 'level': 'CLINIC'},
        )

        if request.method == 'PATCH':
            admin_perm = IsHospitalAdmin()
            if not admin_perm.has_object_permission(request, self, business):
                return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
            acronym = request.data.get('acronym')
            prefix = request.data.get('appointment_reference_prefix')
            update_fields = ['updated_at']
            if acronym is not None:
                profile.acronym = str(acronym).upper().strip()[:20]
                update_fields.append('acronym')
            if prefix is not None:
                profile.appointment_reference_prefix = str(prefix).upper().strip()[:15] or 'RDV'
                update_fields.append('appointment_reference_prefix')
            profile.save(update_fields=update_fields)

        code = get_hospital_code(business)
        ref_prefix = get_reference_prefix(business)
        year = timezone.now().year
        return Response({
            'hospital_id': str(business.id),
            'hospital_name': business.name,
            'acronym': profile.acronym or code,
            'appointment_reference_prefix': ref_prefix,
            'format_template': f'{ref_prefix}-{{SIGLE}}-{year}-{{######}}',
            'format_example': f'{ref_prefix}-{code}-{year}-000128',
            'next_reference': preview_next_appointment_reference(business),
        })

    @action(detail=False, methods=['get', 'patch'], url_path='email-settings')
    def email_settings(self, request):
        """Modèle de message email — accusé de réception à la postulation patient."""
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucun hôpital associé.'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role == 'SUPER_ADMIN':
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        profile, _ = HospitalProfile.objects.get_or_create(
            business=business,
            defaults={'hospital_type': 'PRIVATE', 'level': 'CLINIC'},
        )

        if request.method == 'PATCH':
            admin_perm = IsHospitalAdmin()
            if not admin_perm.has_object_permission(request, self, business):
                return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
            ack = request.data.get('appointment_request_ack_message')
            update_fields = ['updated_at']
            if ack is not None:
                profile.appointment_request_ack_message = str(ack)
                update_fields.append('appointment_request_ack_message')
            profile.save(update_fields=update_fields)

        return Response({
            'hospital_id': str(business.id),
            'hospital_name': business.name,
            'appointment_request_ack_message': profile.appointment_request_ack_message or '',
            'default_booking_ack_template': DEFAULT_BOOKING_ACK_TEMPLATE,
            'effective_booking_ack_template': get_booking_ack_template(business),
            'placeholders': APPOINTMENT_MESSAGE_PLACEHOLDERS,
        })

    @action(detail=False, methods=['get'], url_path='reports')
    def hospital_reports(self, request):
        """Rapports agrégés depuis la base — recettes, consultations, labo."""
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucun hôpital associé.'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role == 'SUPER_ADMIN':
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        admin_perm = IsHospitalAdmin()
        if not admin_perm.has_object_permission(request, self, business):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

        period = (request.query_params.get('period') or 'MONTH').upper()
        now = timezone.now()
        if period == 'TODAY':
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'WEEK':
            start = now - timedelta(days=7)
        else:
            start = now - timedelta(days=30)

        invoices = Invoice.objects.filter(hospital=business, issued_at__gte=start)
        paid = invoices.filter(status='PAID')
        pending = invoices.filter(status='PENDING')
        total_paid = paid.aggregate(total=Sum('amount'))['total'] or 0
        unpaid_amount = pending.aggregate(total=Sum('amount'))['total'] or 0

        appointments = Appointment.objects.filter(hospital=business, appointment_date__gte=start)
        completed_count = appointments.filter(status='COMPLETED').count()
        lab_count = LabResult.objects.filter(hospital=business, created_at__gte=start).count()

        revenue_by_service = []
        if total_paid > 0:
            services = MedicalService.objects.filter(hospital=business, is_active=True)
            covered = 0
            for svc in services:
                amt = paid.filter(appointment__service=svc).aggregate(total=Sum('amount'))['total'] or 0
                if amt:
                    covered += amt
                    revenue_by_service.append({
                        'name': svc.name,
                        'amount': float(amt),
                        'percentage': round(float(amt) / float(total_paid) * 100),
                    })
            other_amt = float(total_paid) - float(covered)
            if other_amt > 0.01:
                revenue_by_service.append({
                    'name': 'Autres prestations',
                    'amount': other_amt,
                    'percentage': round(other_amt / float(total_paid) * 100),
                })
        elif pending.exists():
            for inv in pending.select_related('appointment__service')[:10]:
                svc = inv.appointment.service if inv.appointment and inv.appointment.service_id else None
                svc_name = (svc.name if svc else (inv.description or 'Prestation'))[:80]
                revenue_by_service.append({
                    'name': svc_name,
                    'amount': float(inv.amount),
                    'percentage': 0,
                })

        paid_count = paid.count()
        revenue_by_payment_mode = []
        if paid_count > 0:
            revenue_by_payment_mode.append({
                'mode': 'Encaissements enregistrés (caisse)',
                'amount': float(total_paid),
                'count': paid_count,
            })

        return Response({
            'period': period,
            'currency': 'BIF',
            'total_revenue': float(total_paid),
            'consultations_count': completed_count,
            'lab_tests_count': lab_count,
            'unpaid_bills_count': pending.count(),
            'unpaid_bills_amount': float(unpaid_amount),
            'revenue_by_service': revenue_by_service,
            'revenue_by_payment_mode': revenue_by_payment_mode,
        })

    @action(detail=False, methods=['get'], url_path='audit-logs')
    def hospital_audit_logs(self, request):
        """Journal d'audit filtré pour l'établissement."""
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucun hôpital associé.'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role == 'SUPER_ADMIN':
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        admin_perm = IsHospitalAdmin()
        if not admin_perm.has_object_permission(request, self, business):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

        hospital_id = str(business.id)
        employee_ids = list(
            BusinessEmployee.objects.filter(business=business, is_active=True)
            .values_list('user_id', flat=True)
        )
        user_ids = set(employee_ids)
        if business.owner_id:
            user_ids.add(business.owner_id)

        queryset = AuditLog.objects.filter(
            Q(details__hospital_id=hospital_id) | Q(user_id__in=user_ids)
        ).select_related('user').order_by('-created_at')

        search = (request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(user_email__icontains=search)
                | Q(action__icontains=search)
                | Q(resource__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
            )

        action_filter = (request.query_params.get('action') or '').strip()
        if action_filter and action_filter != 'ALL':
            queryset = queryset.filter(action=action_filter)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AuditLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(queryset[:200], many=True)
        return Response({'results': serializer.data, 'count': queryset.count()})


class DoctorProfileViewSet(viewsets.ModelViewSet):
    queryset = DoctorProfile.objects.all()
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__first_name', 'user__last_name', 'bio', 'medical_license_number']

    # Rôles opérationnels jamais visibles côté client (annuaire / profil hôpital)
    NON_PUBLIC_ACCESS_LEVELS = (
        'RECEPTIONIST_ACCESS',
        'CASHIER_ACCESS',
        'LAB_ACCESS',
    )
    NON_PUBLIC_STAFF_CATEGORIES = ('NURSE', 'RECEPTIONIST')

    @staticmethod
    def _is_receptionist_role(role_obj):
        return bool(role_obj and role_obj.system_access_level == 'RECEPTIONIST_ACCESS')

    @staticmethod
    def _is_non_public_staff_role(role_obj):
        return bool(
            role_obj
            and role_obj.system_access_level in DoctorProfileViewSet.NON_PUBLIC_ACCESS_LEVELS
        )

    @staticmethod
    def _apply_directory_visibility(doctor_profile, role_obj=None):
        """Infirmier / caissier / labo / accueil : invisibles côté client, pas de RDV public."""
        is_non_public = (
            DoctorProfileViewSet._is_non_public_staff_role(role_obj)
            or doctor_profile.staff_category in DoctorProfileViewSet.NON_PUBLIC_STAFF_CATEGORIES
        )
        if is_non_public:
            doctor_profile.is_public_directory = False
            doctor_profile.is_accepting_new_patients = False
            doctor_profile.is_available_for_telemedicine = False
            doctor_profile.is_physical_consultation = False
            access = getattr(role_obj, 'system_access_level', None) if role_obj else None
            if doctor_profile.staff_category not in DoctorProfileViewSet.NON_PUBLIC_STAFF_CATEGORIES:
                if access == 'CASHIER_ACCESS' or access == 'LAB_ACCESS':
                    # Garder la catégorie métier si déjà NURSE ; sinon forcer hors annuaire médecin
                    pass
                elif access == 'RECEPTIONIST_ACCESS':
                    doctor_profile.staff_category = 'RECEPTIONIST'
            doctor_profile.save(update_fields=[
                'is_public_directory', 'is_accepting_new_patients',
                'is_available_for_telemedicine', 'is_physical_consultation',
                'staff_category', 'updated_at',
            ])
        elif role_obj and not DoctorProfileViewSet._is_non_public_staff_role(role_obj):
            if (
                not doctor_profile.is_public_directory
                and doctor_profile.staff_category not in DoctorProfileViewSet.NON_PUBLIC_STAFF_CATEGORIES
            ):
                doctor_profile.is_public_directory = True
                doctor_profile.is_physical_consultation = True
                doctor_profile.save(update_fields=[
                    'is_public_directory', 'is_physical_consultation', 'updated_at',
                ])

    @staticmethod
    def _filter_public_directory(queryset):
        """Exclut infirmiers, caissiers, labo, agents d'accueil et profils non publiés."""
        from django.db.models import Exists, OuterRef
        non_public_emp = BusinessEmployee.objects.filter(
            user_id=OuterRef('user_id'),
            business_id=OuterRef('hospital_id'),
            is_active=True,
            role__system_access_level__in=DoctorProfileViewSet.NON_PUBLIC_ACCESS_LEVELS,
        )
        return queryset.filter(
            is_public_directory=True,
            is_active=True,
            user__is_active=True,
        ).exclude(
            staff_category__in=list(DoctorProfileViewSet.NON_PUBLIC_STAFF_CATEGORIES),
        ).exclude(
            professional_title='INFIRMIER',
        ).exclude(Exists(non_public_emp))

    def get_serializer_class(self):
        if self.action == 'list':
            return DoctorProfileListSerializer
        return DoctorProfileSerializer

    def get_queryset(self):
        queryset = DoctorProfile.objects.select_related(
            'user', 'user__profile', 'hospital'
        ).prefetch_related('specialties', 'services', 'headed_services')
        hospital_id = self.request.query_params.get('hospital')
        is_telemed = self.request.query_params.get('is_available_for_telemedicine')
        is_active = self.request.query_params.get('is_active')
        is_diaspora = self.request.query_params.get('is_diaspora')
        is_tele_expertise = self.request.query_params.get('is_available_for_tele_expertise')
        accepting = self.request.query_params.get('is_accepting_new_patients')
        public_only = self.request.query_params.get('public', '').lower() in ('true', '1')

        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if is_telemed is not None:
            queryset = queryset.filter(
                is_available_for_telemedicine=is_telemed.lower() in ['true', '1']
            )
        if is_active is not None:
            active_bool = is_active.lower() in ['true', '1']
            queryset = queryset.filter(is_active=active_bool, user__is_active=active_bool)
        elif not public_only:
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

        user = self.request.user
        if public_only or not user.is_authenticated:
            queryset = self._filter_public_directory(queryset)

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
                    defaults={
                        'role': role_obj,
                        'position': 'RECEPTIONIST' if self._is_receptionist_role(role_obj) else 'Médecin',
                    }
                )
                self._apply_directory_visibility(doctor_profile, role_obj)
            
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
                defaults={
                    'role': role_obj,
                    'position': 'RECEPTIONIST' if self._is_receptionist_role(role_obj) else 'Médecin',
                }
            )
            self._apply_directory_visibility(instance, role_obj)

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


class IsHospitalStaffWrite(permissions.BasePermission):
    """Lecture publique des créneaux publiés ; écriture réservée au staff hôpital."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'SUPER_ADMIN':
            return False
        if request.user.role in ('BUSINESS_OWNER', 'PROFESSIONAL'):
            return get_user_tenant_business(request.user) is not None
        return BusinessEmployee.objects.filter(user=request.user, is_active=True).exists()


class AppointmentSlotViewSet(viewsets.ModelViewSet):
    """
    Créneaux créés par l'admin — publiés (is_active) pour être visibles côté client.
    """
    queryset = AppointmentSlot.objects.all()
    serializer_class = AppointmentSlotSerializer
    permission_classes = [IsHospitalStaffWrite]

    def get_queryset(self):
        from django.db.models import Count, Q, F

        queryset = AppointmentSlot.objects.select_related(
            'doctor', 'doctor__user', 'hospital', 'service'
        ).annotate(
            _booked=Count('appointments', filter=~Q(appointments__status='CANCELLED'))
        )
        hospital_id = self.request.query_params.get('hospital')
        doctor_id = self.request.query_params.get('doctor')
        status_param = self.request.query_params.get('status')
        upcoming = self.request.query_params.get('upcoming')
        is_active_param = self.request.query_params.get('is_active')
        public_only = self.request.query_params.get('public')

        user = self.request.user
        is_public_request = (
            public_only and public_only.lower() in ('true', '1')
        ) or (
            not user.is_authenticated
            or (hasattr(user, 'role') and user.role == 'CUSTOMER')
        )

        if is_public_request:
            queryset = queryset.filter(
                is_active=True,
                status='OPEN',
                slot_date__gte=timezone.now().date(),
            ).filter(_booked__lt=F('max_patients'))
        elif is_active_param is not None:
            is_active_bool = is_active_param.lower() in ['true', '1', 'yes']
            queryset = queryset.filter(is_active=is_active_bool)

        if user.is_authenticated and hasattr(user, 'doctor_profile') and user.role not in ('SUPER_ADMIN', 'BUSINESS_OWNER'):
            # Médecin : uniquement ses créneaux (même avec ?hospital=),
            # sauf admin établissement / réception.
            hospital_for_perm = None
            if hospital_id:
                hospital_for_perm = Business.objects.filter(id=hospital_id).first()
            if hospital_for_perm is None:
                hospital_for_perm = getattr(user.doctor_profile, 'hospital', None)
            can_see_all = False
            if hospital_for_perm:
                can_see_all = (
                    user_can_manage_hospital_appointments(user, hospital_for_perm)
                    or user_is_receptionist(user, hospital_for_perm)
                )
            if not can_see_all:
                queryset = queryset.filter(doctor=user.doctor_profile)

        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        service_id = self.request.query_params.get('service')
        if service_id:
            queryset = queryset.filter(service_id=service_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if upcoming and upcoming.lower() in ['true', '1']:
            queryset = queryset.filter(slot_date__gte=timezone.now().date())

        return queryset.order_by('slot_date', 'start_time')

    def perform_create(self, serializer):
        slot = serializer.save(
            created_by=self.request.user,
            is_active=serializer.validated_data.get('is_active', False),
            status='OPEN',
        )
        log_slot_action('APPOINTMENT_SLOT_CREATED', slot, self.request.user, self.request)

    def perform_update(self, serializer):
        slot = serializer.save()
        log_slot_action('APPOINTMENT_SLOT_UPDATED', slot, self.request.user, self.request)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publie un créneau — visible côté client."""
        slot = self.get_object()
        slot.is_active = True
        slot.status = 'OPEN'
        slot.save(update_fields=['is_active', 'status', 'updated_at'])
        log_slot_action('APPOINTMENT_SLOT_PUBLISHED', slot, request.user, request)
        return Response(AppointmentSlotSerializer(slot).data)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """Retire un créneau de la vue client."""
        slot = self.get_object()
        slot.is_active = False
        slot.save(update_fields=['is_active', 'updated_at'])
        log_slot_action('APPOINTMENT_SLOT_UNPUBLISHED', slot, request.user, request)
        return Response(AppointmentSlotSerializer(slot).data)

    @action(detail=False, methods=['post'])
    def generate_monthly(self, request):
        """Génère les créneaux du mois à partir des horaires hebdomadaires."""
        hospital_id = request.data.get('hospital')
        doctor_id = request.data.get('doctor')
        year = int(request.data.get('year', timezone.now().year))
        month = int(request.data.get('month', timezone.now().month))
        max_patients = int(request.data.get('max_patients', 10))
        consultation_type = request.data.get('consultation_type', 'IN_PERSON')
        publish = request.data.get('publish', False) in (True, 'true', '1', 1)
        service_id = request.data.get('service')

        if not hospital_id or not doctor_id:
            return Response({'error': 'hospital et doctor sont requis.'}, status=400)
        if not service_id:
            return Response({
                'error': 'Le service médical est obligatoire pour générer des créneaux réservables par service.'
            }, status=400)

        try:
            hospital = Business.objects.get(id=hospital_id)
            doctor = DoctorProfile.objects.get(id=doctor_id, hospital=hospital)
        except (Business.DoesNotExist, DoctorProfile.DoesNotExist):
            return Response({'error': 'Hôpital ou médecin introuvable.'}, status=404)

        service = MedicalService.objects.filter(id=service_id, hospital=hospital).first()
        if not service:
            return Response({'error': 'Service médical introuvable pour cet hôpital.'}, status=404)

        created, message = generate_monthly_slots(
            hospital=hospital,
            doctor=doctor,
            year=year,
            month=month,
            service=service,
            max_patients=max_patients,
            consultation_type=consultation_type,
            created_by=request.user,
            publish=publish,
        )
        log_audit_event(
            user=request.user,
            action='APPOINTMENT_SLOTS_GENERATED',
            resource=f'Monthly slots {year}-{month:02d}',
            request=request,
            details={'created_count': len(created), 'doctor_id': str(doctor_id)},
        )
        return Response({
            'message': message,
            'created_count': len(created),
            'slots': AppointmentSlotSerializer(created, many=True).data,
        })

    @action(detail=False, methods=['post'])
    def generate_monthly_all(self, request):
        """Génère le planning mensuel pour tous les médecins de l'hôpital."""
        hospital_id = request.data.get('hospital')
        year = int(request.data.get('year', timezone.now().year))
        month = int(request.data.get('month', timezone.now().month))
        max_patients = int(request.data.get('max_patients', 10))
        consultation_type = request.data.get('consultation_type', 'IN_PERSON')
        publish = request.data.get('publish', False) in (True, 'true', '1', 1)
        doctor_ids = request.data.get('doctor_ids')  # optionnel

        if not hospital_id:
            return Response({'error': 'hospital est requis.'}, status=400)

        try:
            hospital = Business.objects.get(id=hospital_id)
        except Business.DoesNotExist:
            return Response({'error': 'Hôpital introuvable.'}, status=404)

        result = generate_monthly_slots_for_hospital(
            hospital=hospital,
            year=year,
            month=month,
            max_patients=max_patients,
            consultation_type=consultation_type,
            created_by=request.user,
            publish=publish,
            doctor_ids=doctor_ids,
        )
        log_audit_event(
            user=request.user,
            action='APPOINTMENT_SLOTS_GENERATED_ALL',
            resource=f'Monthly slots all doctors {year}-{month:02d}',
            request=request,
            details={
                'created_count': result['created_count'],
                'doctors_processed': len(result['doctors']),
                'skipped': len(result['skipped']),
            },
        )
        return Response(result)


class AllowAnyCreateOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action == 'create':
            return True
        return bool(request.user and request.user.is_authenticated)


class AppointmentViewSet(viewsets.ModelViewSet):
    """Workflow complet des rendez-vous — Module 01.5 avec isolation Multi-Tenant SaaS"""
    serializer_class = AppointmentSerializer
    permission_classes = [AllowAnyCreateOnly]

    def get_permissions(self):
        if getattr(self, 'action', None) in ('create', 'pay', 'confirm_payment'):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if getattr(self, 'action', None) in ('list', 'queue'):
            return AppointmentListSerializer
        return AppointmentSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if getattr(self, 'action', None) == 'list':
            ctx['exclude_events'] = True
        return ctx

    def get_queryset(self):
        user = self.request.user
        # Paiement public post-réservation (patient non connecté)
        if getattr(self, 'action', None) in ('pay', 'confirm_payment', 'retrieve'):
            if not user.is_authenticated:
                if self.action in ('pay', 'confirm_payment'):
                    return Appointment.objects.select_related(
                        'patient', 'doctor', 'doctor__user', 'slot', 'service', 'hospital',
                    )
                return Appointment.objects.none()

        if not user.is_authenticated:
            return Appointment.objects.none()

        hospital_id = self.request.query_params.get('hospital')

        if user.role == 'SUPER_ADMIN':
            queryset = Appointment.objects.none()
        else:
            # Employé hospitalier d'abord (réception / admin / infirmier),
            # avant le filtre doctor_profile — sinon l'agent d'accueil
            # (souvent PROFESSIONAL + DoctorProfile) ne voit aucun RDV confirmé.
            employees = list(
                BusinessEmployee.objects.filter(user=user, is_active=True).select_related('role', 'business')
            )
            if employees:
                hospital_ids = [e.business_id for e in employees]
                queryset = Appointment.objects.filter(hospital_id__in=hospital_ids)

                # Rôle sur l'hôpital demandé (ou premier établissement)
                emp = None
                if hospital_id:
                    emp = next((e for e in employees if str(e.business_id) == str(hospital_id)), None)
                if emp is None:
                    emp = employees[0]

                hospital = emp.business
                if user_can_manage_hospital_appointments(user, hospital):
                    # Admin / owner côté établissement : tous les RDV de ses hôpitaux
                    pass
                elif user_is_receptionist(user, hospital):
                    from .reception_constants import RECEPTIONIST_VISIBLE_STATUSES
                    queryset = queryset.filter(status__in=RECEPTIONIST_VISIBLE_STATUSES)
                elif hasattr(user, 'doctor_profile'):
                    # Médecin employé : uniquement ses consultations
                    queryset = queryset.filter(doctor=user.doctor_profile)
                # sinon (ex. infirmier) : RDV de l'hôpital employeur
            elif user.role == 'BUSINESS_OWNER' or user.businesses.exists():
                queryset = Appointment.objects.filter(hospital__owner=user)
            elif hasattr(user, 'doctor_profile') and user.role == 'PROFESSIONAL':
                queryset = Appointment.objects.filter(doctor=user.doctor_profile)
            else:
                queryset = Appointment.objects.filter(patient=user)

        appt_status = self.request.query_params.get('status')
        consultation_type = self.request.query_params.get('consultation_type')
        upcoming = self.request.query_params.get('upcoming')  # ?upcoming=true
        slot_id = self.request.query_params.get('slot')
        service_id = self.request.query_params.get('service')
        doctor_id = self.request.query_params.get('doctor')

        if appt_status:
            queryset = queryset.filter(status=appt_status)
        if consultation_type:
            queryset = queryset.filter(consultation_type=consultation_type)
        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if slot_id:
            queryset = queryset.filter(slot_id=slot_id)
        if service_id:
            queryset = queryset.filter(service_id=service_id)
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if upcoming and upcoming.lower() in ['true', '1']:
            queryset = queryset.filter(
                appointment_date__gte=timezone.now(),
                status__in=['PENDING', 'CONFIRMED']
            ).order_by('appointment_date')

        patient_search = self.request.query_params.get('patient_search', '').strip()
        if patient_search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(patient_contact_name__icontains=patient_search)
                | Q(patient__first_name__icontains=patient_search)
                | Q(patient__last_name__icontains=patient_search)
                | Q(reference_code__icontains=patient_search)
                | Q(patient_contact_phone__icontains=patient_search)
                | Q(patient__phone_number__icontains=patient_search)
            )

        return queryset.select_related(
            'patient', 'doctor', 'doctor__user', 'slot', 'service', 'hospital',
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        ordering = request.query_params.get('ordering')
        if ordering in ('appointment_date', '-appointment_date', 'created_at', '-created_at', 'updated_at', '-updated_at'):
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-appointment_date')

        limit_raw = request.query_params.get('limit')
        if limit_raw:
            try:
                limit = min(max(int(limit_raw), 1), 200)
                queryset = queryset[:limit]
            except (TypeError, ValueError):
                pass

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from datetime import datetime

        user = self.request.user
        data = self.request.data
        slot_id = data.get('slot')

        contact_name = (data.get('patient_name') or '').strip()
        contact_phone = (data.get('patient_phone') or '').strip()
        contact_email = (data.get('patient_email') or data.get('email') or '').strip()

        is_patient_booking = (
            not user.is_authenticated
            or (hasattr(user, 'role') and user.role == 'CUSTOMER')
        )

        if is_patient_booking and not slot_id:
            raise ValidationError({
                'slot': 'Vous devez choisir un créneau publié par l\'administration de l\'hôpital.'
            })

        slot = None
        queue_number = None

        if slot_id:
            try:
                slot = AppointmentSlot.objects.get(id=slot_id)
                validate_slot_for_booking(slot)
                queue_number = slot.booked_count + 1
            except AppointmentSlot.DoesNotExist:
                raise ValidationError({'slot': 'Créneau de rendez-vous non trouvé.'})

        if user and user.is_authenticated and not is_patient_booking:
            patient_user = user
        elif user and user.is_authenticated:
            patient_user = user
            if contact_phone and hasattr(patient_user, 'phone_number') and not patient_user.phone_number:
                patient_user.phone_number = contact_phone
                patient_user.save(update_fields=['phone_number'])
        else:
            email = contact_email
            name = contact_name or 'Patient'
            phone = contact_phone

            if not email:
                raise ValidationError({'patient_email': 'Email requis pour la réservation.'})

            parts = name.strip().split()
            first_name = parts[0] if parts else 'Patient'
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

            patient_user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'phone_number': phone,
                    'role': 'CUSTOMER',
                    'is_active': True,
                }
            )
            if not created and phone and not patient_user.phone_number:
                patient_user.phone_number = phone
                patient_user.save(update_fields=['phone_number'])

        if not contact_name:
            contact_name = patient_user.get_full_name() or patient_user.email
        if not contact_email:
            contact_email = patient_user.email
        if not contact_phone:
            contact_phone = getattr(patient_user, 'phone_number', '') or ''

        kwargs = {
            'patient': patient_user,
            'patient_contact_name': contact_name,
            'patient_contact_phone': contact_phone,
            'patient_contact_email': contact_email,
            'created_by': user if user.is_authenticated else None,
            'source': 'RECEPTION' if user.is_authenticated and user.role == 'PROFESSIONAL' else (
                'ADMINISTRATION' if user.is_authenticated and user.role == 'BUSINESS_OWNER' else 'APPLICATION_PATIENT'
            ),
        }
        if slot:
            kwargs['slot'] = slot
            kwargs['queue_number'] = queue_number
            kwargs['doctor'] = slot.doctor
            kwargs['hospital'] = slot.hospital
            if slot.service_id:
                kwargs['service'] = slot.service
            dt = datetime.combine(slot.slot_date, slot.start_time)
            kwargs['appointment_date'] = timezone.make_aware(dt) if timezone.is_naive(dt) else dt
            kwargs['duration_minutes'] = max(15, int(
                ((datetime.combine(slot.slot_date, slot.end_time) - datetime.combine(slot.slot_date, slot.start_time)).seconds) // 60
            )) if slot.end_time and slot.start_time else 30
        elif not is_patient_booking:
            pass  # staff peut créer manuellement sans slot
        else:
            raise ValidationError({'slot': 'Créneau obligatoire.'})

        appointment = serializer.save(**kwargs)
        if not appointment.reference_code:
            appointment.reference_code = generate_appointment_reference(appointment.hospital)
            appointment.save(update_fields=['reference_code', 'updated_at'])

        from .appointment_payment import apply_fee_snapshot
        apply_fee_snapshot(appointment)
        appointment.save(update_fields=[
            'consultation_fee_amount', 'consultation_fee_currency',
            'payment_status', 'payment_method', 'paid_at', 'payment_note',
            'payment_merchant_account', 'updated_at',
        ])

        if slot and slot.booked_count >= slot.max_patients:
            slot.status = 'FULL'
            slot.save(update_fields=['status', 'updated_at'])

        notify_result = notify_appointment_booked(appointment, request=self.request, booked_by=user if user.is_authenticated else None)
        self._booking_notify_result = notify_result

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        response_data = dict(serializer.data)
        notify_result = getattr(self, '_booking_notify_result', None)
        if notify_result:
            response_data['email_notifications'] = notify_result
            response_data['patient_acknowledgment_message'] = notify_result.get('patient_acknowledgment_message', '')
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    # -----------------------------------------------------------------------
    # Actions de workflow (Module 01.5 — Sections 5 & 13)
    # -----------------------------------------------------------------------

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """
        Confirme un rendez-vous en attente (admin hôpital).
        Transition valide : PENDING → CONFIRMED
        """
        appointment = self.get_object()
        if not user_can_manage_hospital_appointments(request.user, appointment.hospital):
            return Response(
                {
                    'error': (
                        'Permission refusée. Seul le propriétaire de l’hôpital '
                        'ou un administrateur hospitalier peut confirmer un rendez-vous. '
                        'Reconnectez-vous avec le compte admin de l’établissement '
                        f'(ex. propriétaire de « {appointment.hospital.name} »).'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if not appointment.can_transition_to('CONFIRMED'):
            return Response(
                {'error': f'Impossible de confirmer un RDV avec le statut "{appointment.get_status_display()}"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        from .appointment_payment import appointment_is_payment_settled
        if appointment.consultation_fee_amount > 0 and not appointment_is_payment_settled(appointment):
            return Response(
                {
                    'error': (
                        'Le patient n\'a pas encore payé la consultation '
                        f'({appointment.consultation_fee_amount} {appointment.consultation_fee_currency}). '
                        'Attendez le paiement Lumicash ou marquez comme payé / exonéré.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        previous_status = appointment.status
        appointment.confirm(confirmed_by=request.user)
        admin_message = (request.data.get('message') or '').strip()
        notify_result = notify_appointment_confirmed(
            appointment,
            confirmed_by=request.user,
            request=request,
            previous_status=previous_status,
            message=admin_message,
        )
        response_data = AppointmentSerializer(appointment).data
        response_data['email_notifications'] = notify_result
        return Response(response_data)

    @action(detail=True, methods=['post'], url_path='pay')
    def pay(self, request, pk=None):
        """
        Patient : paie la consultation (tarif médecin) via Lumicash → marchand hôpital.
        Body: { "payer_phone": "79xxxxxx" }
        """
        from .appointment_payment import initiate_appointment_payment
        from businesses import lumicash as lumicash_client

        appointment = self.get_object()
        payer_phone = (request.data.get('payer_phone') or request.data.get('phone') or '').strip()
        if not payer_phone:
            return Response({'error': 'payer_phone (Lumicash) requis.'}, status=status.HTTP_400_BAD_REQUEST)

        result = initiate_appointment_payment(appointment, payer_phone)
        appointment.refresh_from_db()
        data = AppointmentSerializer(appointment, context=self.get_serializer_context()).data
        return Response({
            'ok': result.get('ok'),
            'already_paid': result.get('already_paid', False),
            'message': result.get('message') or '',
            'stub_mode': result.get('stub_mode', lumicash_client.is_stub_mode()),
            'amount_bif': result.get('amount_bif', appointment.consultation_fee_amount),
            'currency': result.get('currency', appointment.consultation_fee_currency),
            'merchant_account': result.get('merchant_account') or appointment.payment_merchant_account,
            'provider_reference': result.get('provider_reference') or appointment.payment_provider_reference,
            'appointment': data,
        }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        """Simulation : confirme le PIN Lumicash pour un RDV."""
        from .appointment_payment import confirm_appointment_payment_stub

        appointment = self.get_object()
        result = confirm_appointment_payment_stub(appointment)
        appointment.refresh_from_db()
        data = AppointmentSerializer(appointment, context=self.get_serializer_context()).data
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message') or '',
            'appointment': data,
        }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        """Staff hôpital : marque la consultation payée (espèces / autre) ou exonérée."""
        from .appointment_payment import mark_appointment_paid_by_staff

        appointment = self.get_object()
        if not user_can_manage_hospital_appointments(request.user, appointment.hospital):
            # Caissier / réception peuvent aussi
            from .permissions import user_is_receptionist
            is_cashier = False
            emp = BusinessEmployee.objects.filter(
                user=request.user, business=appointment.hospital, is_active=True
            ).select_related('role').first()
            if emp and getattr(emp.role, 'system_access_level', '') == 'CASHIER_ACCESS':
                is_cashier = True
            if not (user_is_receptionist(request.user, appointment.hospital) or is_cashier):
                return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

        waive = request.data.get('waive') in (True, 'true', '1', 1)
        if waive:
            appointment.payment_status = 'WAIVED'
            appointment.paid_at = timezone.now()
            appointment.payment_method = 'WAIVED'
            appointment.payment_note = (request.data.get('note') or 'Exonéré par le personnel')[:255]
            appointment.save(update_fields=[
                'payment_status', 'paid_at', 'payment_method', 'payment_note', 'updated_at',
            ])
            result = {'ok': True, 'message': 'Consultation exonérée.', 'appointment': appointment}
        else:
            result = mark_appointment_paid_by_staff(
                appointment,
                method=(request.data.get('method') or 'CASH'),
                note=(request.data.get('note') or ''),
                actor=request.user,
            )
        appointment.refresh_from_db()
        return Response({
            'ok': True,
            'message': result.get('message'),
            'appointment': AppointmentSerializer(appointment, context=self.get_serializer_context()).data,
        })

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """
        Accueil : enregistre l'arrivée + orientation du patient.
        Body optionnel :
          - orientation_notes: consignes d'orientation (salle, étage…)
          - send_to_waiting_room: bool (défaut True) → statut WAITING_ROOM après arrivée
        Statut : CONFIRMED → PATIENT_ARRIVED [→ WAITING_ROOM]
        Notifie le médecin chargé du RDV.
        """
        appointment = self.get_object()
        if not user_can_check_in_appointment(request.user, appointment):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
        if appointment.status != 'CONFIRMED':
            return Response(
                {'error': 'Seul un rendez-vous confirmé par l\'administration peut être enregistré à l\'arrivée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        orientation_notes = (request.data.get('orientation_notes') or '').strip()
        send_to_waiting = request.data.get('send_to_waiting_room', True) in (True, 'true', '1', 1)

        service_name = appointment.service.name if appointment.service_id else (
            appointment.slot.service.name if appointment.slot_id and appointment.slot.service_id else None
        )
        doctor_name = appointment.doctor.user.get_full_name() if appointment.doctor_id else '—'
        orientation_summary = (
            f"Orienter vers Dr. {doctor_name}"
            + (f" — Service : {service_name}" if service_name else "")
        )
        if orientation_notes:
            orientation_summary = f"{orientation_summary}. {orientation_notes}"

        # Conserver les notes d'orientation sur le RDV
        location = orientation_summary[:300]
        appointment.location_notes = location
        appointment.save(update_fields=['location_notes', 'updated_at'])

        prev = appointment.status
        if not appointment.check_in():
            return Response({'error': 'Transition impossible pour ce statut.'}, status=status.HTTP_400_BAD_REQUEST)
        log_appointment_event(
            appointment, 'CHECK_IN', actor=request.user,
            previous_status=prev, new_status='PATIENT_ARRIVED',
            comment=orientation_summary,
        )

        final_status = 'PATIENT_ARRIVED'
        if send_to_waiting and appointment.can_transition_to('WAITING_ROOM'):
            prev_wr = appointment.status
            if appointment.move_to_waiting_room():
                final_status = 'WAITING_ROOM'
                log_appointment_event(
                    appointment, 'WAITING_ROOM', actor=request.user,
                    previous_status=prev_wr, new_status='WAITING_ROOM',
                    comment=orientation_summary,
                )

        notify_appointment_check_in(
            appointment,
            checked_in_by=request.user,
            request=request,
            orientation_notes=orientation_summary,
            service_name=service_name,
        )
        data = AppointmentSerializer(appointment).data
        data['orientation'] = {
            'doctor': doctor_name,
            'service': service_name,
            'notes': orientation_notes,
            'summary': orientation_summary,
            'status': final_status,
        }
        return Response(data)

    @action(detail=True, methods=['post'])
    def waiting_room(self, request, pk=None):
        """Place le patient en salle d'attente."""
        appointment = self.get_object()
        if not user_can_operate_clinical_workflow(request.user, appointment.hospital):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
        prev = appointment.status
        if not appointment.move_to_waiting_room():
            return Response({'error': 'Transition impossible.'}, status=status.HTTP_400_BAD_REQUEST)
        log_appointment_event(appointment, 'WAITING_ROOM', actor=request.user, previous_status=prev, new_status='WAITING_ROOM')
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Médecin : marque le patient présent pour le RDV (statut PRESENT)."""
        appointment = self.get_object()
        if not user_can_start_consultation(request.user, appointment):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
        prev = appointment.status
        if not appointment.start_consultation():
            return Response({'error': 'Transition impossible.'}, status=status.HTTP_400_BAD_REQUEST)
        log_appointment_event(
            appointment, 'PRESENT', actor=request.user,
            previous_status=prev, new_status='PRESENT',
            comment='Patient marqué présent par le médecin',
        )
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'])
    def mark_no_show(self, request, pk=None):
        """Marque le patient comme absent."""
        appointment = self.get_object()
        if not user_can_operate_clinical_workflow(request.user, appointment.hospital):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
        prev = appointment.status
        if not appointment.mark_no_show():
            return Response({'error': 'Transition impossible.'}, status=status.HTTP_400_BAD_REQUEST)
        log_appointment_event(appointment, 'NO_SHOW', actor=request.user, previous_status=prev, new_status='NO_SHOW', comment=request.data.get('reason', ''))
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Historique des événements du rendez-vous."""
        appointment = self.get_object()
        if not user_can_view_appointment_history(request.user, appointment):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
        from .serializers import AppointmentEventSerializer
        events = appointment.events.select_related('actor').all()
        return Response(AppointmentEventSerializer(events, many=True).data)

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
        prev = appointment.status
        appointment.complete(notes=notes)
        log_appointment_event(appointment, 'COMPLETED', actor=request.user, previous_status=prev, new_status='COMPLETED')
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Refuse une postulation (admin hôpital).
        Body : {"reason": "..."} — envoyé par email au patient.
        """
        appointment = self.get_object()
        if not user_can_manage_hospital_appointments(request.user, appointment.hospital):
            return Response(
                {
                    'error': (
                        'Permission refusée. Seul le propriétaire ou un administrateur '
                        'de l’hôpital peut refuser un rendez-vous.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'error': 'Le motif de refus est obligatoire.'}, status=status.HTTP_400_BAD_REQUEST)
        if not appointment.can_transition_to('REJECTED'):
            return Response(
                {'error': f'Impossible de refuser un RDV avec le statut "{appointment.get_status_display()}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .appointment_payment import (
            appointment_has_collectible_payment,
            refund_appointment_payment,
        )
        auto_refund = request.data.get('refund') in (True, 'true', '1', 1)
        if appointment_has_collectible_payment(appointment):
            if not auto_refund:
                return Response(
                    {
                        'error': (
                            'Ce rendez-vous a déjà été payé. '
                            'Remboursez d\'abord le patient (bouton Rembourser), '
                            'puis refusez — ou envoyez { "reason": "...", "refund": true }.'
                        ),
                        'payment_status': appointment.payment_status,
                        'consultation_fee_amount': appointment.consultation_fee_amount,
                        'requires_refund': True,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            refund_result = refund_appointment_payment(
                appointment,
                note=f'Remboursement lié au refus : {reason}',
                actor=request.user,
            )
            if not refund_result.get('ok'):
                return Response(
                    {'error': refund_result.get('message') or 'Échec remboursement'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            appointment.refresh_from_db()

        previous_status = appointment.status
        appointment.reject(reason=reason, rejected_by=request.user)
        notify_result = notify_appointment_rejected(
            appointment, reason=reason, rejected_by=request.user,
            request=request, previous_status=previous_status,
        )
        response_data = AppointmentSerializer(appointment).data
        response_data['email_notifications'] = notify_result
        response_data['payment_status'] = appointment.payment_status
        return Response(response_data)

    @action(detail=True, methods=['post'], url_path='refund-payment')
    def refund_payment(self, request, pk=None):
        """
        Admin hôpital : rembourse la consultation (PAID → REFUNDED).
        Ensuite le RDV peut être refusé / annulé sans litige d'argent.
        Body optionnel : { "note": "..." }
        """
        from .appointment_payment import refund_appointment_payment

        appointment = self.get_object()
        if not user_can_manage_hospital_appointments(request.user, appointment.hospital):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

        result = refund_appointment_payment(
            appointment,
            note=(request.data.get('note') or '').strip(),
            actor=request.user,
        )
        appointment.refresh_from_db()
        return Response(
            {
                'ok': result.get('ok'),
                'message': result.get('message') or '',
                'stub_mode': result.get('stub_mode', False),
                'amount_bif': result.get('amount_bif'),
                'payer_phone': result.get('payer_phone'),
                'appointment': AppointmentSerializer(
                    appointment, context=self.get_serializer_context()
                ).data,
            },
            status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Annule un rendez-vous.
        Transitions valides : PENDING | CONFIRMED | RESCHEDULED → CANCELLED
        Body optionnel : {"reason": "..."}
        """
        appointment = self.get_object()
        reason = request.data.get('reason')
        is_patient = appointment.patient == request.user
        if not is_patient and not user_can_manage_hospital_appointments(request.user, appointment.hospital):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
        if not appointment.can_transition_to('CANCELLED'):
            return Response(
                {'error': f'Impossible d\'annuler un RDV avec le statut "{appointment.get_status_display()}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .appointment_payment import (
            appointment_has_collectible_payment,
            refund_appointment_payment,
        )
        auto_refund = request.data.get('refund') in (True, 'true', '1', 1)
        if appointment_has_collectible_payment(appointment):
            # Patient qui annule après paiement → remboursement automatique (stub)
            if is_patient:
                auto_refund = True
            if not auto_refund:
                return Response(
                    {
                        'error': (
                            'Ce rendez-vous a déjà été payé. '
                            'Remboursez d\'abord le patient, puis annulez '
                            '— ou envoyez { "refund": true }.'
                        ),
                        'payment_status': appointment.payment_status,
                        'requires_refund': True,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            refund_result = refund_appointment_payment(
                appointment,
                note=f'Remboursement lié à l\'annulation : {reason or ""}',
                actor=request.user,
            )
            if not refund_result.get('ok'):
                return Response(
                    {'error': refund_result.get('message') or 'Échec remboursement'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            appointment.refresh_from_db()

        appointment.cancel(reason=reason, cancelled_by=request.user)
        if not is_patient:
            notify_appointment_cancelled(
                appointment, reason=reason or 'Annulé par l\'administration',
                cancelled_by=request.user, request=request,
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
            appointment.reschedule_reason = reason
            appointment.save(update_fields=['status', 'rescheduled_to', 'cancellation_reason', 'reschedule_reason', 'updated_at'])
            log_appointment_event(appointment, 'RESCHEDULED', actor=request.user, previous_status='CONFIRMED', new_status='RESCHEDULED', comment=reason)

        # Notification au patient (in-app + email)
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
        notify_appointment_rescheduled(
            appointment, new_appointment, reason=reason, actor=request.user,
        )
        return Response({
            'old_appointment': AppointmentSerializer(appointment).data,
            'new_appointment': AppointmentSerializer(new_appointment).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='request-anticipation')
    def request_anticipation(self, request, pk=None):
        """
        Patient : demande d'anticiper OU de reporter le RDV (Historique).
        Body : { "reason": "...", "preferred_date": "ISO optional" }
        """
        from django.utils.dateparse import parse_datetime
        from datetime import datetime as dt
        from .appointment_workflow import (
            get_hospital_staff_to_notify,
            get_patient_display_name,
            log_appointment_event,
        )

        appointment = self.get_object()
        user = request.user
        if not user.is_authenticated or appointment.patient_id != user.id:
            return Response(
                {'error': 'Seul le patient concerné peut demander à déplacer ce rendez-vous.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if appointment.status not in ('PENDING', 'REQUEST_SENT', 'CONFIRMED'):
            return Response(
                {'error': f'Impossible de déplacer un RDV « {appointment.get_status_display()} ».'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if appointment.anticipation_status == 'PENDING':
            return Response(
                {'error': 'Une demande de déplacement est déjà en attente de réponse de l\'hôpital.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response(
                {'error': 'Indiquez le motif de votre demande (anticiper ou reporter).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        preferred_raw = request.data.get('preferred_date') or request.data.get('preferred_at')
        preferred_at = None
        if preferred_raw:
            preferred_at = parse_datetime(str(preferred_raw).replace('Z', '+00:00'))
            if preferred_at is None:
                try:
                    preferred_at = dt.fromisoformat(str(preferred_raw).replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    preferred_at = None
            if preferred_at is None:
                return Response(
                    {'error': 'preferred_date invalide (format ISO attendu).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if timezone.is_naive(preferred_at):
                preferred_at = timezone.make_aware(preferred_at, timezone.get_current_timezone())
            current_at = appointment.appointment_date
            if timezone.is_naive(current_at):
                current_at = timezone.make_aware(current_at, timezone.get_current_timezone())
            if preferred_at < timezone.now() - timedelta(minutes=2):
                return Response(
                    {'error': 'La nouvelle date/heure ne peut pas être dans le passé.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if abs((preferred_at - current_at).total_seconds()) < 120:
                return Response(
                    {'error': 'Choisissez une date/heure différente de votre rendez-vous actuel.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        appointment.anticipation_status = 'PENDING'
        appointment.anticipation_reason = reason[:2000]
        appointment.anticipation_preferred_at = preferred_at
        appointment.anticipation_admin_note = ''
        appointment.anticipation_requested_at = timezone.now()
        appointment.anticipation_resolved_at = None
        appointment.save(update_fields=[
            'anticipation_status', 'anticipation_reason', 'anticipation_preferred_at',
            'anticipation_admin_note', 'anticipation_requested_at', 'anticipation_resolved_at',
            'updated_at',
        ])
        log_appointment_event(
            appointment, 'ANTICIPATION_REQUESTED', actor=user,
            previous_status=appointment.status, new_status=appointment.status,
            comment=reason,
        )

        patient_name = get_patient_display_name(appointment)
        ref = appointment.reference_code or str(appointment.id)[:8]
        current_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
        preferred_label = (
            preferred_at.strftime('%d/%m/%Y à %H:%M') if preferred_at else 'à convenir'
        )
        move_kind = 'déplacer'
        if preferred_at is not None:
            move_kind = 'anticiper' if preferred_at < appointment.appointment_date else 'reporter'
        for staff in get_hospital_staff_to_notify(appointment.hospital):
            Notification.objects.create(
                user=staff,
                notification_type='GENERAL',
                title='Demande de déplacement de RDV',
                message=(
                    f'{patient_name} ({ref}) souhaite {move_kind} son RDV du {current_label} '
                    f'vers {preferred_label}. Motif : {reason}'
                )[:500],
                appointment=appointment,
            )

        return Response({
            'ok': True,
            'message': 'Demande envoyée à l\'hôpital (anticiper ou reporter). Vous serez notifié de la réponse.',
            'appointment': AppointmentSerializer(appointment, context={'request': request}).data,
        })

    @action(detail=True, methods=['post'], url_path='respond-anticipation')
    def respond_anticipation(self, request, pk=None):
        """
        Admin hôpital : accepter ou refuser une demande d'anticipation / report.
        Body : {
          "action": "accept" | "refuse",
          "note": "...",
          "new_date": "ISO" (requis si accept, sinon preferred_date du patient),
          "new_slot": "uuid" (optionnel)
        }
        """
        from django.utils.dateparse import parse_datetime
        from datetime import datetime as dt
        from .appointment_workflow import (
            log_appointment_event,
            user_can_manage_hospital_appointments,
        )

        appointment = self.get_object()
        if not user_can_manage_hospital_appointments(request.user, appointment.hospital):
            return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

        if appointment.anticipation_status != 'PENDING':
            return Response(
                {'error': 'Aucune demande de déplacement en attente pour ce rendez-vous.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action_name = str(request.data.get('action') or '').strip().lower()
        note = (request.data.get('note') or '').strip()
        if action_name not in ('accept', 'refuse', 'accepter', 'refuser'):
            return Response(
                {'error': 'action doit être "accept" ou "refuse".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        accept = action_name in ('accept', 'accepter')
        if accept:
            new_date_raw = request.data.get('new_date') or request.data.get('new_appointment_date')
            new_slot_id = request.data.get('new_slot') or request.data.get('slot')
            new_date = None
            new_slot = None

            if new_slot_id:
                new_slot = AppointmentSlot.objects.filter(
                    id=new_slot_id, hospital=appointment.hospital,
                ).select_related('doctor').first()
                if not new_slot:
                    return Response({'error': 'Créneau introuvable.'}, status=status.HTTP_400_BAD_REQUEST)
                new_date = timezone.make_aware(
                    dt.combine(new_slot.slot_date, new_slot.start_time),
                    timezone.get_current_timezone(),
                )

            if not new_date and new_date_raw:
                raw = str(new_date_raw).strip().replace('Z', '+00:00')
                new_date = parse_datetime(raw)
                if new_date is None:
                    try:
                        # datetime-local: 2026-09-22T11:30 ou avec secondes
                        new_date = dt.fromisoformat(raw)
                    except (ValueError, TypeError):
                        new_date = None
                if new_date is None:
                    return Response(
                        {'error': f'new_date invalide: {new_date_raw!r}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if timezone.is_naive(new_date):
                    new_date = timezone.make_aware(new_date, timezone.get_current_timezone())

            if not new_date:
                new_date = appointment.anticipation_preferred_at
            if not new_date:
                return Response(
                    {'error': 'Indiquez new_date (ou un créneau) pour accepter le déplacement.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if new_date < timezone.now() - timedelta(minutes=2):
                return Response(
                    {'error': 'La nouvelle date ne peut pas être dans le passé.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            previous_date = appointment.appointment_date
            move_kind = 'anticipé' if new_date < previous_date else 'reporté'
            update_fields = [
                'appointment_date', 'anticipation_status', 'anticipation_admin_note',
                'anticipation_resolved_at', 'updated_at', 'reschedule_reason',
            ]
            appointment.appointment_date = new_date
            if new_slot:
                appointment.slot = new_slot
                appointment.doctor = new_slot.doctor
                if new_slot.service_id:
                    appointment.service = new_slot.service
                update_fields.extend(['slot', 'doctor', 'service'])
            appointment.anticipation_status = 'ACCEPTED'
            appointment.anticipation_admin_note = note[:2000]
            appointment.anticipation_resolved_at = timezone.now()
            appointment.reschedule_reason = (
                f'Rendez-vous {move_kind}. '
                f'Ancien créneau : {previous_date.strftime("%d/%m/%Y %H:%M")}. '
                f'{note}'
            ).strip()[:2000]
            appointment.save(update_fields=list(dict.fromkeys(update_fields)))

            log_appointment_event(
                appointment, 'ANTICIPATION_ACCEPTED', actor=request.user,
                previous_status=appointment.status, new_status=appointment.status,
                comment=note or f'Déplacé au {new_date.strftime("%d/%m/%Y %H:%M")}',
            )
            Notification.objects.create(
                user=appointment.patient,
                notification_type='APPOINTMENT_REMINDER',
                title='Déplacement de rendez-vous accepté',
                message=(
                    f'Votre demande a été acceptée. Votre rendez-vous a été {move_kind} '
                    f'au {new_date.strftime("%d/%m/%Y à %H:%M")}.'
                    + (f' Note : {note}' if note else '')
                )[:500],
                appointment=appointment,
            )
            notify_anticipation_response(
                appointment,
                accepted=True,
                previous_date=previous_date,
                note=note,
                actor=request.user,
            )
            return Response({
                'ok': True,
                'message': f'Demande acceptée — rendez-vous {move_kind}.',
                'appointment': AppointmentSerializer(appointment, context={'request': request}).data,
            })

        # refuse
        appointment.anticipation_status = 'REFUSED'
        appointment.anticipation_admin_note = note[:2000] or 'Demande refusée'
        appointment.anticipation_resolved_at = timezone.now()
        appointment.save(update_fields=[
            'anticipation_status', 'anticipation_admin_note', 'anticipation_resolved_at', 'updated_at',
        ])
        log_appointment_event(
            appointment, 'ANTICIPATION_REFUSED', actor=request.user,
            previous_status=appointment.status, new_status=appointment.status,
            comment=note,
        )
        Notification.objects.create(
            user=appointment.patient,
            notification_type='APPOINTMENT_REMINDER',
            title='Déplacement de rendez-vous refusé',
            message=(
                f'Votre demande de déplacement pour le RDV '
                f'{appointment.appointment_date.strftime("%d/%m/%Y à %H:%M")} a été refusée.'
                + (f' Motif : {note}' if note else ' Le créneau initial est maintenu.')
            )[:500],
            appointment=appointment,
        )
        notify_anticipation_response(
            appointment, accepted=False, note=note, actor=request.user,
        )
        return Response({
            'ok': True,
            'message': 'Demande refusée. Le rendez-vous initial est maintenu.',
            'appointment': AppointmentSerializer(appointment, context={'request': request}).data,
        })

    @action(detail=False, methods=['get'], url_path='queue')
    def queue(self, request):
        """File d'attente du jour — accueil / infirmier."""
        hospital_id = request.query_params.get('hospital')
        if not hospital_id:
            return Response({'error': 'hospital requis'}, status=400)
        qs = self.get_queryset().filter(
            hospital_id=hospital_id,
            status__in=['CONFIRMED', 'PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS'],
        ).order_by('queue_number', 'appointment_date')
        serializer = AppointmentListSerializer(
            qs, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='patients')
    def patients_registry(self, request):
        """Patients distincts issus des rendez-vous de l'hôpital."""
        hospital_id = request.query_params.get('hospital')
        if not hospital_id:
            return Response({'error': 'hospital requis'}, status=status.HTTP_400_BAD_REQUEST)

        qs = self.get_queryset().filter(hospital_id=hospital_id).select_related('patient').order_by('-created_at')
        seen = set()
        patients = []
        for apt in qs:
            pid = apt.patient_id
            if pid in seen:
                continue
            seen.add(pid)
            patients.append({
                'id': str(pid),
                'email': apt.patient_contact_email or getattr(apt.patient, 'email', ''),
                'first_name': getattr(apt.patient, 'first_name', '') or '',
                'last_name': getattr(apt.patient, 'last_name', '') or '',
                'full_name': apt.patient_contact_name or apt.patient.get_full_name(),
                'phone': apt.patient_contact_phone or getattr(apt.patient, 'phone_number', '') or '',
                'role': getattr(apt.patient, 'role', 'CUSTOMER'),
            })
        return Response(patients)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Statistiques pour dashboard admin et agent d'accueil."""
        hospital_id = request.query_params.get('hospital')
        if not hospital_id:
            return Response({'error': 'hospital requis'}, status=400)
        qs = self.get_queryset().filter(hospital_id=hospital_id)
        today = timezone.now().date()
        now = timezone.now()
        today_qs = qs.filter(appointment_date__date=today)

        late_qs = today_qs.filter(
            status__in=['CONFIRMED', 'PATIENT_ARRIVED', 'WAITING_ROOM'],
            appointment_date__lt=now - timezone.timedelta(minutes=15),
        )

        try:
            hospital = Business.objects.get(id=hospital_id)
            next_ref = preview_next_appointment_reference(hospital)
            ref_prefix = get_reference_prefix(hospital)
            hospital_code = get_hospital_code(hospital)
        except Business.DoesNotExist:
            next_ref = None
            ref_prefix = 'RDV'
            hospital_code = ''

        available_services = MedicalService.objects.filter(
            hospital_id=hospital_id, is_active=True
        ).count()

        return Response({
            'today_total': today_qs.count(),
            'expected_today': today_qs.filter(
                status__in=['PENDING', 'REQUEST_SENT', 'CONFIRMED']
            ).count(),
            'pending': qs.filter(status__in=['PENDING', 'REQUEST_SENT']).count(),
            'pending_confirmations': qs.filter(status__in=['PENDING', 'REQUEST_SENT']).count(),
            'confirmed_today': today_qs.filter(status='CONFIRMED').count(),
            'arrivals_today': today_qs.filter(
                status__in=['PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS', 'COMPLETED']
            ).count(),
            'in_waiting_room': qs.filter(status='WAITING_ROOM').count(),
            'in_consultation': qs.filter(status__in=['PRESENT', 'IN_PROGRESS']).count(),
            'completed_today': today_qs.filter(status='COMPLETED').count(),
            'no_show_today': today_qs.filter(status='NO_SHOW').count(),
            'cancelled_today': today_qs.filter(status__in=['CANCELLED', 'REJECTED']).count(),
            'late_consultations': late_qs.count(),
            'available_services': available_services,
            'unique_patients': qs.values('patient').distinct().count(),
            'reference_prefix': ref_prefix,
            'hospital_code': hospital_code,
            'next_reference': next_ref,
        })

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
        queryset = super().get_queryset().select_related('hospital', 'prestation_category', 'head_doctor')
        hospital_id = self.request.query_params.get('hospital', None)
        category = self.request.query_params.get('category', None)
        public_only = self.request.query_params.get('public', '').lower() in ('true', '1')
        if hospital_id:
            queryset = queryset.filter(hospital_id=hospital_id)
        if category:
            queryset = queryset.filter(category=category)
        # Catalogue public : uniquement services actifs
        if public_only or not self.request.user.is_authenticated:
            queryset = queryset.filter(is_active=True)
        return queryset


class HospitalExamViewSet(viewsets.ModelViewSet):
    """Catalogue d'examens + tarifs (admin hôpital / lecture publique)."""
    queryset = HospitalExam.objects.all()
    serializer_class = HospitalExamSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description', 'category']

    def get_queryset(self):
        qs = super().get_queryset().select_related('hospital')
        hospital_id = self.request.query_params.get('hospital')
        category = self.request.query_params.get('category')
        public_only = self.request.query_params.get('public', '').lower() in ('true', '1')
        if hospital_id:
            qs = qs.filter(hospital_id=hospital_id)
        if category:
            qs = qs.filter(category=category)
        if public_only or not self.request.user.is_authenticated:
            qs = qs.filter(is_active=True, is_public=True)
        return qs

    def perform_create(self, serializer):
        hospital = serializer.validated_data.get('hospital')
        if hospital is None:
            tenant = get_user_tenant_business(self.request.user)
            if tenant:
                serializer.save(hospital=tenant)
                return
        serializer.save()


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

    @action(detail=False, methods=['post'])
    def apply_template(self, request):
        """
        Applique un modèle d'horaires hebdomadaires à tous les médecins (ou une liste).
        Body: {
          hospital_id, schedules: [{day_of_week, start_time, end_time, is_available}],
          doctor_ids?: [], replace?: true
        }
        """
        hospital_id = request.data.get('hospital_id') or request.data.get('hospital')
        schedules_data = request.data.get('schedules', [])
        doctor_ids = request.data.get('doctor_ids')
        replace = request.data.get('replace', True) in (True, 'true', '1', 1)

        if not hospital_id or not schedules_data:
            return Response(
                {'error': 'hospital_id et schedules sont requis'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            hospital = Business.objects.get(id=hospital_id)
        except Business.DoesNotExist:
            return Response({'error': 'Hôpital introuvable'}, status=status.HTTP_404_NOT_FOUND)

        doctors = DoctorProfile.objects.filter(hospital=hospital, is_active=True)
        if doctor_ids:
            doctors = doctors.filter(id__in=doctor_ids)
        if not doctors.exists():
            return Response({'error': 'Aucun médecin à mettre à jour.'}, status=400)

        normalized = []
        seen_days = set()
        for item in schedules_data:
            try:
                day = int(item.get('day_of_week'))
            except (TypeError, ValueError):
                continue
            if day < 0 or day > 6 or day in seen_days:
                continue
            start = item.get('start_time')
            end = item.get('end_time')
            if not start or not end:
                continue
            raw_avail = item.get('is_available', True)
            is_available = raw_avail not in (False, 'false', '0', 0)
            seen_days.add(day)
            normalized.append({
                'day_of_week': day,
                'start_time': start,
                'end_time': end,
                'is_available': is_available,
            })

        if not normalized:
            return Response({'error': 'Aucun jour valide dans le modèle.'}, status=400)

        updated_doctors = 0
        created_count = 0
        with transaction.atomic():
            for doctor in doctors:
                if replace:
                    DoctorSchedule.objects.filter(doctor=doctor, hospital=hospital).delete()
                for item in normalized:
                    _, created = DoctorSchedule.objects.update_or_create(
                        doctor=doctor,
                        hospital=hospital,
                        day_of_week=item['day_of_week'],
                        defaults={
                            'start_time': item['start_time'],
                            'end_time': item['end_time'],
                            'is_available': item['is_available'],
                        },
                    )
                    if created:
                        created_count += 1
                updated_doctors += 1

        log_audit_event(
            user=request.user,
            action='DOCTOR_SCHEDULE_TEMPLATE_APPLIED',
            resource=f'Schedule template — {hospital.name}',
            request=request,
            details={
                'doctors': updated_doctors,
                'days': len(normalized),
                'replace': replace,
            },
        )
        return Response({
            'message': (
                f'Modèle appliqué à {updated_doctors} médecin(s) '
                f'({len(normalized)} jour(s)/médecin).'
            ),
            'doctors_updated': updated_doctors,
            'days_per_doctor': len(normalized),
            'created_count': created_count,
        }, status=status.HTTP_200_OK)

class MedicalRecordViewSet(viewsets.ModelViewSet):
    """
    Secret Médical & Téléconsultation:
    Seuls le patient concerné, le médecin assigné, ou le personnel autorisé de cet hôpital ont accès.
    """
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsMedicalRecordViewer]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'CUSTOMER':
            return MedicalRecord.objects.filter(patient=user)
        return filter_queryset_by_hospital_tenant(user, MedicalRecord.objects.all())

class LabResultViewSet(viewsets.ModelViewSet):
    """
    Laboratoire :
    - Laborantin : crée le résultat et fait tout le workflow jusqu'à notification patient
    - Admin hôpital / médecins : consultation seule
    - Patient : résultats VALIDATED / COMMUNICATED uniquement
    """
    serializer_class = LabResultSerializer
    permission_classes = [permissions.IsAuthenticated, IsLabTechnician]
    filterset_fields = ['hospital', 'patient', 'status']
    http_method_names = ['get', 'post', 'head', 'options']

    LAB_WORKFLOW_TRANSITIONS = {
        'REQUESTED': {'SAMPLE_COLLECTED'},
        'SAMPLE_COLLECTED': {'IN_ANALYSIS'},
        'IN_ANALYSIS': {'RESULT_AVAILABLE'},
        'RESULT_AVAILABLE': {'VALIDATED'},
        'VALIDATED': {'COMMUNICATED'},
        'COMMUNICATED': set(),
    }

    NEXT_STATUS_LABELS = {
        'SAMPLE_COLLECTED': 'Enregistrer le prélèvement',
        'IN_ANALYSIS': 'Démarrer l\'analyse',
        'RESULT_AVAILABLE': 'Saisir le résultat disponible',
        'VALIDATED': 'Valider le résultat',
        'COMMUNICATED': 'Notifier le patient',
    }

    def get_queryset(self):
        user = self.request.user
        if user.role == 'CUSTOMER':
            return LabResult.objects.filter(patient=user, status__in=['VALIDATED', 'COMMUNICATED'])
        return filter_queryset_by_hospital_tenant(user, LabResult.objects.all()).select_related(
            'patient', 'hospital', 'appointment',
            'ordered_by', 'ordered_by__user', 'validated_by', 'validated_by__user', 'uploaded_by'
        )

    @action(detail=False, methods=['get'], url_path='eligible-appointments')
    def eligible_appointments(self, request):
        """
        RDV éligibles pour créer un résultat labo :
        patient déjà Présent (après confirmation + arrivée), ou en consultation / terminé.
        """
        hospital_id = request.query_params.get('hospital')
        hospital = Business.objects.filter(id=hospital_id).first() if hospital_id else get_user_tenant_business(request.user)
        if not hospital:
            return Response({'error': 'hospital requis'}, status=status.HTTP_400_BAD_REQUEST)
        if not user_can_view_lab_results(request.user, hospital) and not user_is_lab_technician(request.user, hospital):
            raise PermissionDenied("Accès refusé.")

        qs = Appointment.objects.filter(
            hospital=hospital,
            status__in=['PRESENT', 'IN_PROGRESS', 'COMPLETED'],
            patient__isnull=False,
        ).select_related('patient', 'doctor', 'doctor__user', 'service').order_by('-appointment_date')

        data = []
        for apt in qs[:200]:
            doctor_name = None
            if apt.doctor and apt.doctor.user:
                doctor_name = f"{apt.doctor.user.first_name} {apt.doctor.user.last_name}".strip()
            data.append({
                'id': str(apt.id),
                'reference_code': apt.reference_code,
                'status': apt.status,
                'status_display': apt.get_status_display(),
                'appointment_date': apt.appointment_date,
                'patient': str(apt.patient_id),
                'patient_name': (
                    apt.patient_contact_name
                    or apt.patient.get_full_name()
                    or apt.patient.email
                ),
                'patient_email': apt.patient.email,
                'doctor_id': str(apt.doctor_id) if apt.doctor_id else None,
                'doctor_name': doctor_name,
                'service_name': apt.service.name if apt.service_id else None,
            })
        return Response(data)

    def create(self, request, *args, **kwargs):
        hospital_id = request.data.get('hospital')
        hospital = Business.objects.filter(id=hospital_id).first() if hospital_id else get_user_tenant_business(request.user)
        if not hospital or not user_is_lab_technician(request.user, hospital):
            raise PermissionDenied("Seul un laborantin peut créer un résultat de laboratoire.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        hospital = serializer.validated_data.get('hospital')
        if not hospital:
            raise ValidationError({'hospital': 'Hôpital requis.'})
        if not user_is_lab_technician(self.request.user, hospital):
            raise PermissionDenied("Seul un laborantin peut créer un résultat de laboratoire.")
        result_value = (serializer.validated_data.get('result_value') or '').strip()
        if not result_value:
            serializer.validated_data['result_value'] = 'En attente'
        serializer.save(uploaded_by=self.request.user, status='REQUESTED')

    def update(self, request, *args, **kwargs):
        raise PermissionDenied("Modification libre interdite. Utilisez le workflow de statut.")

    def partial_update(self, request, *args, **kwargs):
        raise PermissionDenied("Modification libre interdite. Utilisez le workflow de statut.")

    def destroy(self, request, *args, **kwargs):
        raise PermissionDenied("Suppression interdite. Utilisez le workflow de statut.")

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """
        Laborantin uniquement — avance le workflow jusqu'à notification patient.
        Workflow: REQUESTED → SAMPLE_COLLECTED → IN_ANALYSIS → RESULT_AVAILABLE → VALIDATED → COMMUNICATED
        """
        from django.utils import timezone

        lab_result = self.get_object()
        new_status = request.data.get('status')

        if not user_is_lab_technician(request.user, lab_result.hospital):
            return Response(
                {'error': "Seul un laborantin peut faire avancer le workflow laboratoire."},
                status=status.HTTP_403_FORBIDDEN
            )

        valid_statuses = ['SAMPLE_COLLECTED', 'IN_ANALYSIS', 'RESULT_AVAILABLE', 'VALIDATED', 'COMMUNICATED']
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Statut invalide. Valeurs acceptées: {", ".join(valid_statuses)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        allowed_next = self.LAB_WORKFLOW_TRANSITIONS.get(lab_result.status, set())
        if new_status not in allowed_next:
            return Response(
                {
                    'error': (
                        f"Transition invalide: {lab_result.status} -> {new_status}. "
                        f"Transition autorisée: {', '.join(sorted(allowed_next)) or 'aucune'}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Avant validation / communication : un résultat doit être renseigné
        if new_status in ('RESULT_AVAILABLE', 'VALIDATED', 'COMMUNICATED'):
            result_value = (request.data.get('result_value') or lab_result.result_value or '').strip()
            if not result_value:
                return Response(
                    {'error': 'Le résultat (valeur) est requis avant cette étape.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            lab_result.result_value = result_value
            if 'unit' in request.data:
                lab_result.unit = request.data.get('unit') or ''
            if 'reference_values' in request.data:
                lab_result.reference_values = request.data.get('reference_values') or ''
            if 'result_notes' in request.data:
                lab_result.result_notes = request.data.get('result_notes') or ''
            if 'document_url' in request.data:
                lab_result.document_url = request.data.get('document_url') or None

        lab_result.status = new_status

        if new_status == 'VALIDATED':
            lab_result.validation_date = timezone.now()
            # Si le laborantin a aussi un profil médecin, on le trace ; sinon date seule.
            if hasattr(request.user, 'doctor_profile'):
                lab_result.validated_by = request.user.doctor_profile

        if new_status == 'COMMUNICATED':
            lab_result.communication_date = timezone.now()
            from .models import Notification
            Notification.objects.create(
                user=lab_result.patient,
                notification_type='LAB_RESULT',
                title='Résultat de laboratoire disponible',
                message=(
                    f'Votre résultat d\'examen "{lab_result.test_name}" est maintenant disponible. '
                    'Veuillez consulter votre espace patient.'
                ),
                lab_result=lab_result,
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
        hospital_id = self.request.query_params.get('hospital')
        if user.role == 'SUPER_ADMIN':
            qs = Prescription.objects.none()
        elif user.role == 'CUSTOMER':
            qs = Prescription.objects.filter(patient=user)
        elif hasattr(user, 'doctor_profile'):
            qs = Prescription.objects.filter(doctor=user.doctor_profile)
        else:
            qs = filter_queryset_by_hospital_tenant(user, Prescription.objects.all())

        if hospital_id:
            qs = qs.filter(hospital_id=hospital_id)
        return qs.select_related('patient', 'doctor', 'doctor__user', 'hospital')

    def perform_create(self, serializer):
        user = self.request.user
        doctor = getattr(user, 'doctor_profile', None)
        if not doctor:
            raise PermissionDenied("Seul un médecin peut créer une prescription.")

        hospital = serializer.validated_data.get('hospital')
        if hospital and doctor.hospital_id and doctor.hospital_id != hospital.id:
            raise ValidationError({'hospital': "Hôpital incohérent avec le profil médecin."})

        # Le patient vient du payload (pas le médecin connecté).
        serializer.save(doctor=doctor)

class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Accès Caissier & Facturation:
    Isolation stricte par établissement de santé / hôpital.
    """
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsCashier]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'CUSTOMER':
            return Invoice.objects.filter(patient=user)
        return filter_queryset_by_hospital_tenant(user, Invoice.objects.all())


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
            return ServiceAssignment.objects.none()
        if user.role == 'BUSINESS_OWNER':
            return qs.filter(hospital__owner=user)

        return qs.filter(hospital__employees__user=user)

