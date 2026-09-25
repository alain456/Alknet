from datetime import timedelta

from rest_framework import serializers
from .models import (
    Specialty, DoctorProfile, Appointment, AppointmentSlot, MedicalService,
    DoctorSchedule, MedicalRecord, LabResult, Invoice,
    Notification, Prescription, HospitalProfile, ServiceAssignment,
    ServiceCategory, HospitalExam
)


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ['id', 'hospital', 'name', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


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
            'acronym', 'appointment_reference_prefix', 'hospital_type', 'operational_status', 'level', 'reference_level',
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
    public_photo_url = serializers.SerializerMethodField()
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
            'bio', 'photo_url', 'public_photo_url',
            'office_address',
            # Modes de consultation
            'is_physical_consultation', 'is_available_for_telemedicine',
            'is_available_for_tele_expertise', 'consultation_modes',
            # Disponibilité
            'is_active', 'is_public_directory', 'is_accepting_new_patients',
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
        avatar = None
        if obj.hospital:
            emp = obj.user.employments.filter(business=obj.hospital).first()
            if emp and emp.role:
                role_name = emp.role.name
                role_id = str(emp.role.id)
        profile = getattr(obj.user, 'profile', None)
        if profile and profile.avatar:
            avatar = profile.avatar
        return {
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name,
            "email": obj.user.email,
            "role_name": role_name,
            "role_id": role_id,
            "avatar": avatar,
        }

    def get_public_photo_url(self, obj):
        if obj.photo_url:
            return obj.photo_url
        profile = getattr(obj.user, 'profile', None)
        if profile and profile.avatar:
            return profile.avatar
        return None

    def get_services(self, obj):
        return MedicalServiceSerializer(obj.related_services_queryset(), many=True).data

    def get_schedules(self, obj):
        return DoctorScheduleSerializer(obj.schedules.all(), many=True).data

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_formatted_fee(self, obj):
        return obj.formatted_fee

    def get_consultation_modes(self, obj):
        return obj.consultation_modes

    def validate_photo_url(self, value):
        if value in (None, ''):
            return value
        value = str(value).strip()
        if value.startswith('data:image/'):
            # ~1.4 Mo base64 ≈ image compressée raisonnable pour l'annuaire public
            if len(value) > 1_800_000:
                raise serializers.ValidationError(
                    "Photo trop volumineuse. Compressez l'image (max ~1 Mo) avant l'envoi."
                )
            return value
        if value.startswith('http://') or value.startswith('https://'):
            return value
        raise serializers.ValidationError(
            "La photo doit être une URL https://… ou une image téléversée."
        )

    def update(self, instance, validated_data):
        # Ne pas effacer la photo si le front renvoie '' (liste allégée sans data:image)
        if 'photo_url' in validated_data and not (validated_data.get('photo_url') or '').strip():
            validated_data.pop('photo_url', None)
        return super().update(instance, validated_data)


def _safe_image_ref(value, *, max_data_len=400_000):
    """
    Retourne une référence image affichable.
    - http(s) /media /static : toujours OK
    - data:image/… : OK si taille raisonnable (photos compressées côté client)
    Les data: trop volumineux sont exclus des listes pour éviter les 502.
    """
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    if not v:
        return None
    if v.startswith(('http://', 'https://', '/media/', '/static/')):
        return v
    if v.startswith('data:image/') and len(v) <= max_data_len:
        return v
    return None


class DoctorProfileListSerializer(serializers.ModelSerializer):
    """Version allégée pour les listes d'annuaire."""
    full_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    hospital_id = serializers.UUIDField(source='hospital.id', read_only=True)
    user_details = serializers.SerializerMethodField()
    specialties = SpecialtySerializer(many=True, read_only=True)
    services = serializers.SerializerMethodField()
    formatted_fee = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    public_photo_url = serializers.SerializerMethodField()
    has_photo = serializers.SerializerMethodField()
    staff_category_display = serializers.CharField(
        source='get_staff_category_display', read_only=True
    )
    professional_title_display = serializers.CharField(
        source='get_professional_title_display', read_only=True
    )

    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'full_name', 'user_details', 'photo_url', 'public_photo_url', 'has_photo',
            'hospital_id', 'hospital_name',
            'staff_category', 'staff_category_display',
            'professional_title', 'professional_title_display',
            'specialties', 'sub_specialty', 'services',
            'languages_spoken', 'qualifications', 'experience_years', 'bio',
            'medical_license_number', 'office_address',
            'is_physical_consultation', 'is_available_for_telemedicine',
            'is_accepting_new_patients', 'is_active', 'is_public_directory',
            'consultation_fee', 'formatted_fee', 'consultation_fee_currency',
            'is_diaspora', 'diaspora_country',
        ]

    def get_user_details(self, obj):
        profile = getattr(obj.user, 'profile', None)
        avatar = _safe_image_ref(getattr(profile, 'avatar', None) if profile else None)
        return {
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'avatar': avatar,
        }

    def get_photo_url(self, obj):
        return _safe_image_ref(obj.photo_url)

    def get_public_photo_url(self, obj):
        url = _safe_image_ref(obj.photo_url)
        if url:
            return url
        profile = getattr(obj.user, 'profile', None)
        return _safe_image_ref(getattr(profile, 'avatar', None) if profile else None)

    def get_has_photo(self, obj):
        if obj.photo_url:
            return True
        profile = getattr(obj.user, 'profile', None)
        return bool(profile and profile.avatar)

    def get_services(self, obj):
        # Tous les services (M2M + chef de service + affectations) pour l'annuaire client
        return [
            {
                'id': str(s.id),
                'name': s.name,
                'formatted_cost': s.formatted_cost,
                'online_booking_available': s.online_booking_available,
            }
            for s in obj.related_services_queryset()
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
    ends_at = serializers.SerializerMethodField()
    ends_next_day = serializers.SerializerMethodField()

    class Meta:
        model = DoctorSchedule
        fields = [
            'id', 'doctor', 'doctor_name', 'hospital', 'hospital_name',
            'schedule_date', 'day_of_week', 'day_name', 'start_time', 'end_time',
            'ends_at', 'ends_next_day', 'is_available',
        ]

    def get_doctor_name(self, obj):
        return f"{obj.doctor.user.first_name} {obj.doctor.user.last_name}"

    def get_ends_next_day(self, obj):
        if not obj.start_time or not obj.end_time:
            return False
        return obj.end_time <= obj.start_time

    def get_ends_at(self, obj):
        if not obj.schedule_date or not obj.end_time:
            return None
        end_date = obj.schedule_date
        if self.get_ends_next_day(obj):
            end_date = obj.schedule_date + timedelta(days=1)
        return f"{end_date.isoformat()}T{obj.end_time.strftime('%H:%M')}"

    def validate(self, attrs):
        schedule_date = attrs.get('schedule_date', getattr(self.instance, 'schedule_date', None))
        if self.instance is None and not schedule_date:
            raise serializers.ValidationError({
                'schedule_date': "La date du créneau est requise pour déterminer l'heure de fin.",
            })
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if start and end and start == end:
            raise serializers.ValidationError({
                'end_time': "L'heure de fin doit être différente de l'heure de début.",
            })
        if schedule_date:
            attrs['day_of_week'] = schedule_date.weekday()
        return attrs


class AppointmentSlotSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    doctor_title = serializers.SerializerMethodField()
    doctor_office_address = serializers.CharField(source='doctor.office_address', read_only=True, allow_null=True)
    consultation_fee = serializers.SerializerMethodField()
    consultation_fee_currency = serializers.SerializerMethodField()
    formatted_consultation_fee = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True, allow_null=True)
    booked_count = serializers.IntegerField(read_only=True)
    remaining_slots = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    class Meta:
        model = AppointmentSlot
        fields = [
            'id', 'hospital', 'hospital_name', 'doctor', 'doctor_name', 'doctor_title',
            'doctor_office_address',
            'consultation_fee', 'consultation_fee_currency', 'formatted_consultation_fee',
            'service', 'service_name', 'title', 'slot_date', 'start_time', 'end_time',
            'consultation_type', 'max_patients', 'booked_count', 'remaining_slots',
            'is_full', 'status', 'is_active', 'notes', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
        extra_kwargs = {
            'service': {'required': True, 'allow_null': False},
        }

    def validate_service(self, value):
        if not value:
            raise serializers.ValidationError(
                'Le service médical est obligatoire. Le patient doit pouvoir choisir un RDV par service.'
            )
        return value

    def validate(self, attrs):
        doctor = attrs.get('doctor') or getattr(self.instance, 'doctor', None)
        service = attrs.get('service') or getattr(self.instance, 'service', None)
        if doctor and service:
            # Médecin doit être affecté au service (ou chef de service)
            assigned = doctor.services.filter(pk=service.pk).exists()
            is_head = getattr(service, 'head_doctor_id', None) == doctor.id
            if not assigned and not is_head:
                # Autoriser quand même mais avertir via auto-affectation douce
                doctor.services.add(service)

        max_patients = attrs.get('max_patients')
        if self.instance is not None and max_patients is not None:
            booked = self.instance.booked_count
            if max_patients < booked:
                raise serializers.ValidationError({
                    'max_patients': (
                        f'La capacité ({max_patients}) ne peut pas être inférieure '
                        f'au nombre d\'inscrits ({booked}).'
                    )
                })
        return attrs

    def get_doctor_name(self, obj):
        return obj.doctor.user.get_full_name()

    def get_doctor_title(self, obj):
        return obj.doctor.get_staff_category_display()

    def get_consultation_fee(self, obj):
        from .appointment_payment import fee_from_doctor
        amount, _ = fee_from_doctor(obj.doctor)
        return amount

    def get_consultation_fee_currency(self, obj):
        return getattr(obj.doctor, 'consultation_fee_currency', None) or 'BIF'

    def get_formatted_consultation_fee(self, obj):
        amount = self.get_consultation_fee(obj)
        currency = self.get_consultation_fee_currency(obj)
        if amount <= 0:
            return 'Gratuit'
        return f'{amount:,.0f} {currency}'.replace(',', ' ')


class AppointmentEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        from .models import AppointmentEvent
        model = AppointmentEvent
        fields = [
            'id', 'event_type', 'event_type_display', 'previous_status', 'new_status',
            'actor', 'actor_name', 'comment', 'created_at',
        ]

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.email
        return 'Système'


class AppointmentListSerializer(serializers.ModelSerializer):
    """
    Liste / file d'attente — sans photos base64 ni events (évite payloads multi-Mo → 502).
    """
    doctor_name = serializers.SerializerMethodField()
    doctor_details = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    patient_phone = serializers.SerializerMethodField()
    patient_email = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    consultation_type_display = serializers.CharField(
        source='get_consultation_type_display', read_only=True
    )
    service_name = serializers.CharField(source='service.name', read_only=True, allow_null=True)
    confirmed_by_name = serializers.SerializerMethodField()
    valid_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'patient_phone', 'patient_email',
            'doctor', 'doctor_name', 'doctor_details',
            'slot', 'queue_number', 'reference_code',
            'service', 'service_name', 'source', 'appointment_category', 'duration_minutes',
            'hospital', 'hospital_name',
            'appointment_date', 'status', 'status_display',
            'consultation_type', 'consultation_type_display',
            'reason', 'notes', 'location_notes',
            'telemedicine_link', 'telemedicine_room_id',
            'confirmed_by', 'confirmed_by_name',
            'confirmed_at', 'checked_in_at', 'started_at', 'completed_at',
            'consultation_fee_amount', 'consultation_fee_currency',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_provider_reference', 'payment_merchant_account',
            'paid_at', 'payment_note',
            'anticipation_status', 'anticipation_preferred_at', 'anticipation_reason',
            'anticipation_admin_note', 'anticipation_requested_at', 'anticipation_resolved_at',
            'valid_transitions',
            'created_at', 'updated_at',
        ]

    def get_doctor_name(self, obj):
        if not obj.doctor_id:
            return None
        user = getattr(obj.doctor, 'user', None)
        if user:
            name = user.get_full_name()
            return name.strip() if name and name.strip() else user.email
        return str(obj.doctor_id)

    def get_confirmed_by_name(self, obj):
        user = getattr(obj, 'confirmed_by', None)
        if not user:
            return None
        full = user.get_full_name()
        return (full or '').strip() or user.email or str(user)

    def get_doctor_details(self, obj):
        """Minimal — pas de photo_url / avatar base64."""
        if not obj.doctor_id:
            return None
        doc = obj.doctor
        user = getattr(doc, 'user', None)
        full = self.get_doctor_name(obj)
        return {
            'id': str(doc.id),
            'full_name': full,
            'user_details': {
                'first_name': getattr(user, 'first_name', '') or '',
                'last_name': getattr(user, 'last_name', '') or '',
                'avatar': None,
            },
            'staff_category': getattr(doc, 'staff_category', None),
            'staff_category_display': (
                doc.get_staff_category_display() if hasattr(doc, 'get_staff_category_display') else None
            ),
            'professional_title': getattr(doc, 'professional_title', None),
            'professional_title_display': (
                doc.get_professional_title_display()
                if hasattr(doc, 'get_professional_title_display') else None
            ),
        }

    def get_patient_name(self, obj):
        if obj.patient_contact_name and obj.patient_contact_name.strip():
            return obj.patient_contact_name.strip()
        if obj.patient:
            full = obj.patient.get_full_name()
            return full.strip() if full and full.strip() else obj.patient.email
        return 'Patient'

    def get_patient_phone(self, obj):
        if obj.patient_contact_phone and obj.patient_contact_phone.strip():
            return obj.patient_contact_phone.strip()
        return getattr(obj.patient, 'phone_number', '') or ''

    def get_patient_email(self, obj):
        if obj.patient_contact_email and obj.patient_contact_email.strip():
            return obj.patient_contact_email.strip()
        return obj.patient.email if obj.patient else ''

    def get_valid_transitions(self, obj):
        return obj.VALID_TRANSITIONS.get(obj.status, [])


class AppointmentSerializer(serializers.ModelSerializer):
    """Rendez-vous complet avec workflow et téléconsultation — Module 01.5"""
    doctor_details = DoctorProfileListSerializer(source='doctor', read_only=True)
    slot_details = AppointmentSlotSerializer(source='slot', read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_phone = serializers.SerializerMethodField()
    patient_email = serializers.SerializerMethodField()
    # Champs écriture (réservation publique)
    patient_name_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, source='patient_contact_name'
    )
    patient_phone_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, source='patient_contact_phone'
    )
    patient_email_input = serializers.EmailField(
        write_only=True, required=False, allow_blank=True, source='patient_contact_email'
    )
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    # Géolocalisation de l'hôpital du RDV
    hospital_latitude = serializers.FloatField(source='hospital.latitude', read_only=True)
    hospital_longitude = serializers.FloatField(source='hospital.longitude', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    consultation_type_display = serializers.CharField(
        source='get_consultation_type_display', read_only=True
    )
    service_name = serializers.CharField(source='service.name', read_only=True, allow_null=True)
    confirmed_by_name = serializers.SerializerMethodField()
    events = AppointmentEventSerializer(many=True, read_only=True)
    valid_transitions = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Liste : sans events (N+1 / payload lourd) — disponible via retrieve ou /history/
        if self.context.get('exclude_events'):
            self.fields.pop('events', None)

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'patient_phone', 'patient_email',
            'patient_name_input', 'patient_phone_input', 'patient_email_input',
            'doctor', 'doctor_details',
            'slot', 'slot_details', 'queue_number', 'reference_code',
            'service', 'service_name', 'source', 'appointment_category', 'duration_minutes',
            'created_by', 'confirmed_by', 'confirmed_by_name',
            'hospital', 'hospital_name', 'hospital_latitude', 'hospital_longitude',
            'appointment_date', 'status', 'status_display',
            'consultation_type', 'consultation_type_display',
            'reason', 'notes', 'location_notes',
            # Téléconsultation
            'telemedicine_link', 'telemedicine_room_id',
            # Reprogrammation
            'rescheduled_to', 'cancellation_reason', 'reschedule_reason', 'cancelled_by',
            # Notifications
            'reminder_24h_sent', 'reminder_1h_sent',
            # Dates clés
            'confirmed_at', 'checked_in_at', 'started_at', 'completed_at', 'cancelled_at',
            # Paiement consultation (tarif médecin)
            'consultation_fee_amount', 'consultation_fee_currency',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_provider_reference', 'payment_merchant_account',
            'paid_at', 'payment_note',
            'anticipation_status', 'anticipation_preferred_at', 'anticipation_reason',
            'anticipation_admin_note', 'anticipation_requested_at', 'anticipation_resolved_at',
            'events',
            # Transitions valides
            'valid_transitions',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'patient', 'status', 'queue_number', 'reference_code',
            'confirmed_at', 'checked_in_at', 'started_at', 'completed_at',
            'cancelled_at', 'reminder_24h_sent', 'reminder_1h_sent',
            'created_by', 'confirmed_by', 'confirmed_by_name', 'events',
            'consultation_fee_amount', 'consultation_fee_currency',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_provider_reference', 'payment_merchant_account',
            'paid_at', 'payment_note',
            'anticipation_status', 'anticipation_preferred_at', 'anticipation_reason',
            'anticipation_admin_note', 'anticipation_requested_at', 'anticipation_resolved_at',
        ]
        extra_kwargs = {
            'doctor': {'required': False},
            'hospital': {'required': False},
            'appointment_date': {'required': False},
        }

    def validate(self, attrs):
        slot = attrs.get('slot')
        if slot:
            attrs['doctor'] = slot.doctor
            attrs['hospital'] = slot.hospital
        return attrs

    def get_confirmed_by_name(self, obj):
        user = getattr(obj, 'confirmed_by', None)
        if not user:
            return None
        full = user.get_full_name()
        return (full or '').strip() or user.email or str(user)

    def get_patient_name(self, obj):
        if obj.patient_contact_name and obj.patient_contact_name.strip():
            return obj.patient_contact_name.strip()
        if obj.patient:
            full = obj.patient.get_full_name()
            return full.strip() if full and full.strip() else obj.patient.email
        return 'Patient'

    def get_patient_phone(self, obj):
        if obj.patient_contact_phone and obj.patient_contact_phone.strip():
            return obj.patient_contact_phone.strip()
        return getattr(obj.patient, 'phone_number', '') or ''

    def get_patient_email(self, obj):
        if obj.patient_contact_email and obj.patient_contact_email.strip():
            return obj.patient_contact_email.strip()
        return obj.patient.email if obj.patient else ''

    def get_valid_transitions(self, obj):
        """Retourne les transitions de statut disponibles depuis l'état actuel."""
        return obj.VALID_TRANSITIONS.get(obj.status, [])


# ---------------------------------------------------------------------------
# 01.2 — SERVICES MÉDICAUX
# ---------------------------------------------------------------------------

class MedicalServiceSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    prestation_category_name = serializers.CharField(
        source='prestation_category.name', read_only=True, allow_null=True
    )
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
            'category', 'category_display', 'prestation_category', 'prestation_category_name',
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
        extra_kwargs = {
            'head_doctor': {'required': False, 'allow_null': True},
            'prestation_category': {'required': False, 'allow_null': True},
        }

    def validate_operating_hours(self, value):
        if value is None or value == '':
            return {}
        if isinstance(value, str):
            return {'note': value.strip()}
        if isinstance(value, dict):
            return value
        raise serializers.ValidationError('Format horaires invalide.')

    def validate_category(self, value):
        valid = {c[0] for c in MedicalService.CATEGORY_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(
                f'Catégorie invalide « {value} ». Utilisez une catégorie standard ou une catégorie personnalisée (prestation_category).'
            )
        return value

    def validate(self, attrs):
        if attrs.get('head_doctor') == '':
            attrs['head_doctor'] = None
        return attrs

    def _is_public_reader(self):
        request = self.context.get('request')
        if request is None:
            return False
        public_only = getattr(request, 'query_params', {}).get('public')
        if public_only and str(public_only).lower() in ('true', '1'):
            return True
        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return True
        return getattr(user, 'role', None) == 'CUSTOMER'

    def get_head_doctor_name(self, obj):
        doctor = obj.head_doctor
        if not doctor:
            return None
        if self._is_public_reader() and (
            not doctor.is_public_directory
            or doctor.staff_category in ('NURSE', 'RECEPTIONIST', 'ACCOUNTANT')
            or doctor.professional_title == 'INFIRMIER'
        ):
            return None
        return f"{doctor.user.first_name} {doctor.user.last_name}"

    def get_formatted_cost(self, obj):
        return obj.formatted_cost

    def get_assigned_doctors_details(self, obj):
        doctors = obj.assigned_doctors.all()
        if self._is_public_reader():
            doctors = doctors.filter(
                is_public_directory=True,
                is_active=True,
            ).exclude(
                staff_category__in=['NURSE', 'RECEPTIONIST', 'ACCOUNTANT'],
            ).exclude(professional_title='INFIRMIER')
        return [
            {
                "id": str(doc.id),
                "full_name": doc.user.get_full_name(),
                "professional_title": doc.get_professional_title_display(),
                "staff_category": doc.staff_category,
                "staff_category_display": doc.get_staff_category_display(),
            }
            for doc in doctors
        ]


class HospitalExamSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    formatted_price = serializers.SerializerMethodField()

    class Meta:
        model = HospitalExam
        fields = [
            'id', 'hospital', 'hospital_name',
            'name', 'category', 'category_display', 'description',
            'price', 'currency', 'price_notes', 'formatted_price',
            'preparation', 'loinc_code', 'is_active', 'is_public', 'display_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_formatted_price(self, obj):
        return obj.formatted_price

    def validate_name(self, value):
        name = (value or '').strip()
        if len(name) < 2:
            raise serializers.ValidationError("Le nom de l'examen est requis.")
        return name

    def validate_price(self, value):
        if value is None:
            return 0
        if value < 0:
            raise serializers.ValidationError('Le tarif ne peut pas être négatif.')
        return value


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
    appointment_reference = serializers.CharField(
        source='appointment.reference_code', read_only=True, allow_null=True
    )
    appointment_status = serializers.CharField(
        source='appointment.status', read_only=True, allow_null=True
    )
    hospital_exam_name = serializers.CharField(source='hospital_exam.name', read_only=True, allow_null=True)
    document_display_url = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True, allow_null=True)
    events = serializers.SerializerMethodField()

    # RDV éligible si création manuelle (sans prescription)
    LAB_ELIGIBLE_APPOINTMENT_STATUSES = ('PRESENT', 'IN_PROGRESS', 'COMPLETED')

    class Meta:
        model = LabResult
        fields = [
            'id', 'patient', 'patient_name', 'patient_email',
            'hospital', 'hospital_name',
            'appointment', 'appointment_reference', 'appointment_status',
            'prescription',
            'hospital_exam', 'hospital_exam_name',
            'ordered_by', 'ordered_by_name',
            'uploaded_by', 'validated_by', 'validated_by_user', 'validated_by_name',
            'invoice', 'invoice_number',
            'test_name', 'test_date', 'result_value', 'unit', 'reference_values',
            'result_notes', 'parameters',
            'document', 'document_url', 'document_display_url',
            'status', 'status_display',
            'validation_date', 'communication_date',
            'fhir_resource_type', 'fhir_service_request_id', 'fhir_diagnostic_report_id',
            'events',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'uploaded_by', 'validated_by', 'validated_by_user', 'validation_date',
            'communication_date', 'invoice', 'created_at', 'updated_at',
            'document_display_url', 'events',
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
        if obj.validated_by_user_id:
            u = obj.validated_by_user
            return (u.get_full_name() or u.email) if u else None
        return None

    def get_document_display_url(self, obj):
        url = obj.document_display_url
        if not url:
            return ''
        request = self.context.get('request')
        if request and url.startswith('/'):
            return request.build_absolute_uri(url)
        return url

    def get_events(self, obj):
        events = getattr(obj, '_prefetched_objects_cache', {}).get('events')
        qs = events if events is not None else obj.events.all()[:20]
        return [
            {
                'id': str(e.id),
                'action': e.action,
                'from_status': e.from_status,
                'to_status': e.to_status,
                'note': e.note,
                'actor_email': e.actor.email if e.actor_id else None,
                'created_at': e.created_at,
            }
            for e in qs
        ]

    def validate(self, attrs):
        hospital = attrs.get('hospital') or getattr(self.instance, 'hospital', None)
        patient = attrs.get('patient') or getattr(self.instance, 'patient', None)
        ordered_by = attrs.get('ordered_by') or getattr(self.instance, 'ordered_by', None)
        appointment = attrs.get('appointment')
        prescription = attrs.get('prescription') or getattr(self.instance, 'prescription', None)
        status_value = attrs.get('status')

        if hospital and ordered_by and ordered_by.hospital_id != hospital.id:
            raise serializers.ValidationError({
                'ordered_by': "Le médecin prescripteur doit appartenir au même hôpital."
            })

        if not self.instance and status_value and status_value != 'REQUESTED':
            raise serializers.ValidationError({
                'status': "À la création, le statut doit être REQUESTED."
            })

        if not self.instance:
            if not patient or not hospital:
                raise serializers.ValidationError({
                    'patient': "Patient et hôpital sont requis."
                })
            # Création depuis prescription : RDV optionnel
            if prescription:
                if prescription.hospital_id != hospital.id:
                    raise serializers.ValidationError({'prescription': 'Prescription d’un autre hôpital.'})
                if prescription.patient_id != patient.id:
                    raise serializers.ValidationError({'prescription': 'Patient incohérent avec la prescription.'})
                return attrs

            if not appointment:
                raise serializers.ValidationError({
                    'appointment': (
                        "Sélectionnez un rendez-vous, ou créez la demande via une prescription d’examen."
                    )
                })
            if appointment.hospital_id != hospital.id:
                raise serializers.ValidationError({
                    'appointment': "Le rendez-vous doit appartenir au même hôpital."
                })
            if appointment.patient_id != patient.id:
                raise serializers.ValidationError({
                    'appointment': "Le rendez-vous ne correspond pas au patient sélectionné."
                })
            if appointment.status in ('PENDING', 'REQUEST_SENT'):
                raise serializers.ValidationError({
                    'appointment': (
                        "Impossible : le rendez-vous est encore en attente de confirmation."
                    )
                })
            if appointment.status not in self.LAB_ELIGIBLE_APPOINTMENT_STATUSES:
                raise serializers.ValidationError({
                    'appointment': (
                        f"Impossible de créer un résultat pour un RDV « {appointment.get_status_display()} ». "
                        "Le patient doit d'abord être marqué Présent."
                    )
                })

        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    appointment_reference = serializers.SerializerMethodField()
    act_type_display = serializers.CharField(source='get_act_type_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'patient', 'patient_name', 'hospital',
            'appointment', 'appointment_reference',
            'amount', 'currency', 'description', 'act_type', 'act_type_display', 'act_label',
            'status', 'payment_method', 'payment_method_display',
            'issued_at', 'paid_at',
        ]
        read_only_fields = ['invoice_number', 'issued_at', 'paid_at']

    def get_patient_name(self, obj):
        appointment = getattr(obj, 'appointment', None)
        if appointment is not None:
            contact = (appointment.patient_contact_name or '').strip()
            if contact:
                return contact
        if obj.patient:
            full = (obj.patient.get_full_name() or '').strip()
            return full or obj.patient.email or 'Patient'
        return 'Patient'

    def get_appointment_reference(self, obj):
        if obj.appointment_id and obj.appointment:
            return obj.appointment.reference_code or ''
        return ''


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
    lab_result_id = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = [
            'id', 'patient', 'patient_email', 'patient_name',
            'doctor', 'doctor_name', 'hospital',
            'prescription_type', 'prescription_type_display',
            'medication_name', 'dosage', 'frequency', 'duration', 'instructions',
            'exam_name', 'exam_reason', 'hospital_exam', 'appointment',
            'is_active', 'is_dispensed', 'is_completed',
            'prescribed_at', 'valid_until', 'lab_result_id',
        ]
        read_only_fields = ['prescribed_at', 'doctor', 'lab_result_id']

    def get_lab_result_id(self, obj):
        lab = obj.lab_results.order_by('-created_at').first()
        return str(lab.id) if lab else None

    def validate(self, attrs):
        ptype = attrs.get('prescription_type') or getattr(self.instance, 'prescription_type', None)
        if ptype == 'MEDICATION' and not (attrs.get('medication_name') or getattr(self.instance, 'medication_name', '')):
            raise serializers.ValidationError({'medication_name': 'Nom du médicament requis.'})
        exam = attrs.get('hospital_exam')
        if ptype == 'EXAM':
            exam_name = attrs.get('exam_name') or getattr(self.instance, 'exam_name', '')
            if exam and not exam_name:
                attrs['exam_name'] = exam.name
            elif not exam_name and not exam:
                raise serializers.ValidationError({'exam_name': "Nom de l'examen requis."})
            hospital = attrs.get('hospital') or getattr(self.instance, 'hospital', None)
            if exam and hospital and exam.hospital_id != hospital.id:
                raise serializers.ValidationError({'hospital_exam': 'Examen d’un autre hôpital.'})
        return attrs

    def get_patient_email(self, obj):
        return obj.patient.email if obj.patient else None

    def get_patient_name(self, obj):
        if obj.patient:
            return f"{obj.patient.first_name} {obj.patient.last_name}"
        return None

    def get_doctor_name(self, obj):
        if obj.doctor and obj.doctor.user:
            return f"{obj.doctor.user.first_name} {obj.doctor.user.last_name}"
        return None


class ServiceAssignmentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.CharField(source='user.email', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    role_in_service_display = serializers.CharField(source='get_role_in_service_display', read_only=True)

    class Meta:
        model = ServiceAssignment
        fields = [
            'id', 'hospital', 'user', 'user_email', 'user_name',
            'service', 'service_name', 'role_in_service', 'role_in_service_display',
            'is_primary', 'is_active', 'assigned_at', 'updated_at'
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name()
