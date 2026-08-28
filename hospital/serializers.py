from rest_framework import serializers
from .models import (
    Specialty, DoctorProfile, Appointment, MedicalService,
    DoctorSchedule, MedicalRecord, LabResult, Invoice,
    Notification, Prescription, HospitalProfile,
)


# ---------------------------------------------------------------------------
# 01.1 — SÉRIALISER LA FICHE HÔPITAL (avec géolocalisation)
# ---------------------------------------------------------------------------

class HospitalProfileSerializer(serializers.ModelSerializer):
    """Fiche identité complète d'un hôpital — Module 01.1"""
    # Champs issus du modèle Business générique (géolocalisation incluse)
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_address = serializers.CharField(source='business.address', read_only=True)
    business_phone = serializers.CharField(source='business.phone', read_only=True)
    business_email = serializers.EmailField(source='business.email', read_only=True)
    business_website = serializers.URLField(source='business.website', read_only=True)

    # Géolocalisation (depuis Business) — Point clé pour le bouton "Itinéraire"
    latitude = serializers.FloatField(source='business.latitude', read_only=True)
    longitude = serializers.FloatField(source='business.longitude', read_only=True)
    province = serializers.CharField(source='business.province', read_only=True)
    commune = serializers.CharField(source='business.commune', read_only=True)
    logo = serializers.CharField(source='business.logo', read_only=True)

    # Propriétés calculées
    is_open_now = serializers.SerializerMethodField()
    display_type_level = serializers.SerializerMethodField()
    google_maps_url = serializers.SerializerMethodField()
    waze_url = serializers.SerializerMethodField()

    class Meta:
        model = HospitalProfile
        fields = [
            # Identifiants
            'id', 'business',
            # Champs Business (géoloc + contacts)
            'business_name', 'business_address', 'business_phone', 'business_email',
            'business_website', 'logo',
            # Géolocalisation
            'latitude', 'longitude', 'province', 'commune',
            'google_maps_url', 'waze_url',
            # Identité hôpital
            'acronym', 'hospital_type', 'operational_status', 'level', 'reference_level',
            'display_type_level',
            # Urgences & disponibilité
            'emergency_available', 'emergency_phone', 'is_open_now',
            # Horaires
            'opening_hours',
            # Langues & accréditation
            'languages_available', 'accreditation_number', 'accreditation_body',
            'accreditation_valid_until',
            # Capacité
            'bed_capacity', 'icu_beds',
            # Télémédecine
            'telemedicine_unit_available', 'telemedicine_unit_description',
            # Assurances
            'accepted_insurances',
            # Service clientèle
            'customer_service_phone', 'customer_service_whatsapp',
            'customer_service_email', 'customer_service_available_24_7',
            # Médias
            'cover_image_url', 'gallery_urls', 'presentation_video_url',
            # Réseaux sociaux
            'facebook_url', 'twitter_url', 'linkedin_url',
            # Timestamps
            'created_at', 'updated_at',
        ]

    def get_is_open_now(self, obj):
        return obj.is_open_now

    def get_display_type_level(self, obj):
        return obj.display_type_level

    def get_google_maps_url(self, obj):
        """Génère l'URL Google Maps pour le bouton 'Itinéraire'."""
        lat = obj.business.latitude
        lng = obj.business.longitude
        if lat and lng:
            return f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
        if obj.business.address:
            import urllib.parse
            addr = urllib.parse.quote(obj.business.address)
            return f"https://www.google.com/maps/search/?api=1&query={addr}"
        return None

    def get_waze_url(self, obj):
        """Génère l'URL Waze pour la navigation."""
        lat = obj.business.latitude
        lng = obj.business.longitude
        if lat and lng:
            return f"https://waze.com/ul?ll={lat},{lng}&navigate=yes"
        return None


class HospitalProfileListSerializer(serializers.ModelSerializer):
    """Version allégée pour les listes et la carte."""
    business_name = serializers.CharField(source='business.name', read_only=True)
    latitude = serializers.FloatField(source='business.latitude', read_only=True)
    longitude = serializers.FloatField(source='business.longitude', read_only=True)
    province = serializers.CharField(source='business.province', read_only=True)
    logo = serializers.CharField(source='business.logo', read_only=True)
    is_open_now = serializers.SerializerMethodField()

    class Meta:
        model = HospitalProfile
        fields = [
            'id', 'business', 'business_name', 'logo',
            'latitude', 'longitude', 'province',
            'acronym', 'hospital_type', 'level', 'operational_status',
            'emergency_available', 'telemedicine_unit_available',
            'is_open_now', 'customer_service_available_24_7',
        ]

    def get_is_open_now(self, obj):
        return obj.is_open_now


# ---------------------------------------------------------------------------
# 01.3 — SPÉCIALITÉS & MÉDECINS
# ---------------------------------------------------------------------------

class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = '__all__'


class DoctorProfileSerializer(serializers.ModelSerializer):
    """Profil complet d'un médecin — Module 01.3"""
    specialties = SpecialtySerializer(many=True, read_only=True)
    specialty_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False,
        queryset=Specialty.objects.all(), source='specialties'
    )
    services = serializers.SerializerMethodField()
    service_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True,
        queryset=MedicalService.objects.all(), source='services', required=False
    )
    user_details = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    # Géolocalisation de l'hôpital de rattachement
    hospital_latitude = serializers.FloatField(source='hospital.latitude', read_only=True)
    hospital_longitude = serializers.FloatField(source='hospital.longitude', read_only=True)
    full_name = serializers.SerializerMethodField()
    schedules = serializers.SerializerMethodField()
    # Champs calculés
    formatted_fee = serializers.SerializerMethodField()
    consultation_modes = serializers.SerializerMethodField()
    staff_category_display = serializers.CharField(
        source='get_staff_category_display', read_only=True
    )
    professional_title_display = serializers.CharField(
        source='get_professional_title_display', read_only=True
    )

    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'user', 'user_details', 'full_name',
            'hospital', 'hospital_name', 'hospital_latitude', 'hospital_longitude',
            'specialties', 'specialty_ids', 'services', 'service_ids',
            'sub_specialty',
            # Identité
            'staff_category', 'staff_category_display',
            'professional_title', 'professional_title_display',
            'gender', 'medical_license_number',
            'languages_spoken', 'qualifications', 'experience_years',
            'bio', 'photo_url',
            # Modes de consultation
            'is_physical_consultation', 'is_available_for_telemedicine',
            'is_available_for_tele_expertise', 'consultation_modes',
            # Disponibilité
            'is_active', 'is_accepting_new_patients',
            # Tarif
            'consultation_fee', 'consultation_fee_currency',
            'accepted_payment_methods', 'formatted_fee',
            # Diaspora (01.11)
            'is_diaspora', 'diaspora_country', 'diaspora_timezone',
            'diaspora_institution', 'diaspora_verification_status',
            'tele_expertise_count',
            # Horaires
            'schedules',
            'created_at', 'updated_at',
        ]

    def get_user_details(self, obj):
        role_name = "Non attribué"
        role_id = None
        if obj.hospital:
            emp = obj.user.employments.filter(business=obj.hospital).first()
            if emp and emp.role:
                role_name = emp.role.name
                role_id = str(emp.role.id)
        return {
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name,
            "email": obj.user.email,
            "role_name": role_name,
            "role_id": role_id,
        }

    def get_services(self, obj):
        return MedicalServiceSerializer(obj.services.all(), many=True).data

    def get_schedules(self, obj):
        return DoctorScheduleSerializer(obj.schedules.all(), many=True).data

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_formatted_fee(self, obj):
        return obj.formatted_fee

    def get_consultation_modes(self, obj):
        return obj.consultation_modes


class DoctorProfileListSerializer(serializers.ModelSerializer):
    """Version allégée pour les listes d'annuaire."""
    full_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    specialties = SpecialtySerializer(many=True, read_only=True)
    formatted_fee = serializers.SerializerMethodField()

    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'full_name', 'photo_url', 'hospital_name',
            'professional_title', 'specialties', 'sub_specialty',
            'is_physical_consultation', 'is_available_for_telemedicine',
            'is_accepting_new_patients', 'is_active',
            'formatted_fee', 'consultation_fee_currency',
            'is_diaspora', 'diaspora_country',
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_formatted_fee(self, obj):
        return obj.formatted_fee


# ---------------------------------------------------------------------------
# 01.4 & 01.5 — HORAIRES & RENDEZ-VOUS
# ---------------------------------------------------------------------------

class DoctorScheduleSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = [
            'id', 'doctor', 'doctor_name', 'hospital', 'hospital_name',
            'day_of_week', 'day_name', 'start_time', 'end_time', 'is_available'
        ]

    def get_doctor_name(self, obj):
        return f"{obj.doctor.user.first_name} {obj.doctor.user.last_name}"


class AppointmentSerializer(serializers.ModelSerializer):
    """Rendez-vous complet avec workflow et téléconsultation — Module 01.5"""
    doctor_details = DoctorProfileListSerializer(source='doctor', read_only=True)
    patient_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    # Géolocalisation de l'hôpital du RDV
    hospital_latitude = serializers.FloatField(source='hospital.latitude', read_only=True)
    hospital_longitude = serializers.FloatField(source='hospital.longitude', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    consultation_type_display = serializers.CharField(
        source='get_consultation_type_display', read_only=True
    )
    # Transitions valides depuis le statut actuel
    valid_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name',
            'doctor', 'doctor_details',
            'hospital', 'hospital_name', 'hospital_latitude', 'hospital_longitude',
            'appointment_date', 'status', 'status_display',
            'consultation_type', 'consultation_type_display',
            'reason', 'notes', 'location_notes',
            # Téléconsultation
            'telemedicine_link', 'telemedicine_room_id',
            # Reprogrammation
            'rescheduled_to', 'cancellation_reason', 'cancelled_by',
            # Notifications
            'reminder_24h_sent', 'reminder_1h_sent',
            # Dates clés
            'confirmed_at', 'completed_at', 'cancelled_at',
            # Transitions valides
            'valid_transitions',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'patient', 'status', 'confirmed_at', 'completed_at',
            'cancelled_at', 'reminder_24h_sent', 'reminder_1h_sent',
        ]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_valid_transitions(self, obj):
        """Retourne les transitions de statut disponibles depuis l'état actuel."""
        return obj.VALID_TRANSITIONS.get(obj.status, [])


# ---------------------------------------------------------------------------
# 01.2 — SERVICES MÉDICAUX
# ---------------------------------------------------------------------------

class MedicalServiceSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    availability_display = serializers.CharField(source='get_availability_display', read_only=True)
    head_doctor_name = serializers.SerializerMethodField()
    formatted_cost = serializers.SerializerMethodField()
    assigned_doctors_details = serializers.SerializerMethodField()
    assigned_doctor_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False,
        queryset=DoctorProfile.objects.all(), source='assigned_doctors'
    )

    class Meta:
        model = MedicalService
        fields = [
            'id', 'hospital', 'hospital_name',
            'category', 'category_display',
            'service_type', 'service_type_display',
            'name', 'description',
            'head_doctor', 'head_doctor_name',
            'assigned_doctors_details', 'assigned_doctor_ids',
            'contact_phone', 'contact_email',
            'availability', 'availability_display', 'operating_hours',
            'indicative_cost', 'currency', 'cost_notes', 'formatted_cost',
            'access_conditions',
            'telemedicine_available', 'online_booking_available',
            'is_active', 'display_order',
            'created_at', 'updated_at',
        ]

    def get_head_doctor_name(self, obj):
        if obj.head_doctor:
            return f"{obj.head_doctor.user.first_name} {obj.head_doctor.user.last_name}"
        return None

    def get_formatted_cost(self, obj):
        return obj.formatted_cost

    def get_assigned_doctors_details(self, obj):
        return [
            {
                "id": str(doc.id),
                "full_name": doc.user.get_full_name(),
                "professional_title": doc.get_professional_title_display(),
                "staff_category": doc.staff_category,
                "staff_category_display": doc.get_staff_category_display(),
            }
            for doc in obj.assigned_doctors.all()
        ]


# ---------------------------------------------------------------------------
# Autres serializers
# ---------------------------------------------------------------------------

class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = '__all__'

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "Inconnu"

    def get_doctor_name(self, obj):
        if obj.doctor:
            return f"{obj.doctor.user.first_name} {obj.doctor.user.last_name}"
        return "N/A"


class LabResultSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    patient_email = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    ordered_by_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LabResult
        fields = [
            'id', 'patient', 'patient_name', 'patient_email',
            'hospital', 'hospital_name',
            'ordered_by', 'ordered_by_name',
            'uploaded_by', 'validated_by', 'validated_by_name',
            'test_name', 'test_date', 'result_value', 'unit', 'reference_values',
            'result_notes', 'document_url',
            'status', 'status_display',
            'validation_date', 'communication_date',
            'created_at', 'updated_at',
        ]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "Inconnu"

    def get_patient_email(self, obj):
        return obj.patient.email if obj.patient else None

    def get_ordered_by_name(self, obj):
        if obj.ordered_by:
            return f"{obj.ordered_by.user.first_name} {obj.ordered_by.user.last_name}"
        return None

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            return f"{obj.validated_by.user.first_name} {obj.validated_by.user.last_name}"
        return None


class InvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "Inconnu"


class NotificationSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', read_only=True
    )
    lab_result_summary = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'user_email',
            'notification_type', 'notification_type_display',
            'title', 'message',
            'lab_result', 'lab_result_summary', 'appointment',
            'is_read', 'read_at', 'created_at',
        ]

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def get_lab_result_summary(self, obj):
        if obj.lab_result:
            return {
                'test_name': obj.lab_result.test_name,
                'status': obj.lab_result.status,
                'test_date': obj.lab_result.test_date,
            }
        return None


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_email = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    prescription_type_display = serializers.CharField(
        source='get_prescription_type_display', read_only=True
    )

    class Meta:
        model = Prescription
        fields = [
            'id', 'patient', 'patient_email', 'patient_name',
            'doctor', 'doctor_name', 'hospital',
            'prescription_type', 'prescription_type_display',
            'medication_name', 'dosage', 'frequency', 'duration', 'instructions',
            'exam_name', 'exam_reason',
            'is_active', 'is_dispensed', 'is_completed',
            'prescribed_at', 'valid_until',
        ]
        read_only_fields = ['prescribed_at']

    def get_patient_email(self, obj):
        return obj.patient.email if obj.patient else None

    def get_patient_name(self, obj):
        if obj.patient:
            return f"{obj.patient.first_name} {obj.patient.last_name}"
        return None

    def get_doctor_name(self, obj):
        if obj.doctor:
            return f"{obj.doctor.user.first_name} {obj.doctor.user.last_name}"
        return None
