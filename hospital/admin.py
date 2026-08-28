from django.contrib import admin
from .models import (
    HospitalProfile, MedicalService, DoctorProfile, DoctorSchedule,
    Appointment, MedicalRecord, LabResult, Notification, Prescription,
    Invoice, Specialty,
)


# ---------------------------------------------------------------------------
# 01.1 — PROFIL HÔPITAL
# ---------------------------------------------------------------------------
@admin.register(HospitalProfile)
class HospitalProfileAdmin(admin.ModelAdmin):
    list_display = (
        'business', 'acronym', 'hospital_type', 'level',
        'operational_status', 'emergency_available',
        'telemedicine_unit_available', 'customer_service_available_24_7',
    )
    list_filter = (
        'hospital_type', 'level', 'operational_status',
        'emergency_available', 'telemedicine_unit_available',
        'customer_service_available_24_7',
    )
    search_fields = ('business__name', 'acronym', 'accreditation_number')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        ('🏥 Identification', {
            'fields': ('business', 'acronym', 'hospital_type', 'operational_status', 'level', 'reference_level')
        }),
        ('🚨 Urgences', {
            'fields': ('emergency_available', 'emergency_phone')
        }),
        ('🕐 Horaires', {
            'fields': ('opening_hours',)
        }),
        ('🌐 Langues & Accréditation', {
            'fields': ('languages_available', 'accreditation_number', 'accreditation_body', 'accreditation_valid_until')
        }),
        ('🛏️ Capacité', {
            'fields': ('bed_capacity', 'icu_beds')
        }),
        ('📹 Télémédecine', {
            'fields': ('telemedicine_unit_available', 'telemedicine_unit_description')
        }),
        ('🛡️ Assurances', {
            'fields': ('accepted_insurances',)
        }),
        ('📞 Service Clientèle 24/7', {
            'fields': (
                'customer_service_available_24_7', 'customer_service_phone',
                'customer_service_whatsapp', 'customer_service_email',
            )
        }),
        ('🖼️ Médias', {
            'fields': ('cover_image_url', 'gallery_urls', 'presentation_video_url')
        }),
        ('📱 Réseaux Sociaux', {
            'fields': ('facebook_url', 'twitter_url', 'linkedin_url'),
            'classes': ('collapse',)
        }),
        ('ℹ️ Métadonnées', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ---------------------------------------------------------------------------
# 01.2 — SERVICES MÉDICAUX
# ---------------------------------------------------------------------------
@admin.register(MedicalService)
class MedicalServiceAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'hospital', 'category', 'service_type',
        'availability', 'formatted_cost', 'telemedicine_available',
        'online_booking_available', 'is_active', 'display_order',
    )
    list_filter = (
        'category', 'service_type', 'availability',
        'telemedicine_available', 'online_booking_available', 'is_active',
    )
    search_fields = ('name', 'hospital__name', 'description')
    list_editable = ('is_active', 'display_order')
    readonly_fields = ('id', 'created_at', 'updated_at')
    ordering = ('display_order', 'category', 'name')
    fieldsets = (
        ('📋 Identification', {
            'fields': ('hospital', 'name', 'category', 'service_type', 'description', 'display_order')
        }),
        ('👨‍⚕️ Responsable', {
            'fields': ('head_doctor',)
        }),
        ('📞 Contact Direct', {
            'fields': ('contact_phone', 'contact_email')
        }),
        ('🕐 Disponibilité & Horaires', {
            'fields': ('availability', 'operating_hours')
        }),
        ('💰 Tarification', {
            'fields': ('indicative_cost', 'currency', 'cost_notes')
        }),
        ('🔑 Conditions d\'accès', {
            'fields': ('access_conditions',)
        }),
        ('💻 Options Numériques', {
            'fields': ('telemedicine_available', 'online_booking_available', 'is_active')
        }),
        ('ℹ️ Métadonnées', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ---------------------------------------------------------------------------
# Autres modèles
# ---------------------------------------------------------------------------
@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'created_at')
    search_fields = ('name',)


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'hospital', 'gender', 'is_available_for_telemedicine', 'consultation_fee')
    list_filter = ('is_available_for_telemedicine', 'gender')
    search_fields = ('user__first_name', 'user__last_name', 'medical_license_number')
    filter_horizontal = ('specialties', 'services')


@admin.register(DoctorSchedule)
class DoctorScheduleAdmin(admin.ModelAdmin):
    list_display = ('doctor', 'hospital', 'day_of_week', 'start_time', 'end_time', 'is_available')
    list_filter = ('day_of_week', 'is_available')


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('patient', 'doctor', 'hospital', 'appointment_date', 'status', 'consultation_type')
    list_filter = ('status', 'consultation_type')
    search_fields = ('patient__email', 'doctor__user__email')


@admin.register(LabResult)
class LabResultAdmin(admin.ModelAdmin):
    list_display = ('test_name', 'patient', 'hospital', 'status', 'test_date', 'validated_by')
    list_filter = ('status',)
    search_fields = ('test_name', 'patient__email')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'hospital', 'amount', 'status', 'issued_at')
    list_filter = ('status',)

