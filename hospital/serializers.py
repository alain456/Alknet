from rest_framework import serializers
from .models import Specialty, DoctorProfile, Appointment, MedicalService, DoctorSchedule, MedicalRecord, LabResult, Invoice

class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = '__all__'

class DoctorProfileSerializer(serializers.ModelSerializer):
    specialties = SpecialtySerializer(many=True, read_only=True)
    specialty_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Specialty.objects.all(), source='specialties'
    )
    user_details = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)

    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'user', 'user_details', 'hospital', 'hospital_name', 
            'specialties', 'specialty_ids', 'medical_license_number', 
            'bio', 'is_available_for_telemedicine', 'consultation_fee', 
            'created_at', 'updated_at'
        ]
        
    def get_user_details(self, obj):
        return {
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name,
            "email": obj.user.email,
        }

class AppointmentSerializer(serializers.ModelSerializer):
    doctor_details = DoctorProfileSerializer(source='doctor', read_only=True)
    patient_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'doctor', 'doctor_details',
            'hospital', 'hospital_name', 'appointment_date', 'status', 
            'consultation_type', 'reason', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['patient', 'status']

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

class MedicalServiceSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)

    class Meta:
        model = MedicalService
        fields = ['id', 'hospital', 'hospital_name', 'name', 'description', 'is_active', 'created_at']

class DoctorScheduleSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = ['id', 'doctor', 'doctor_name', 'hospital', 'hospital_name', 
                  'day_of_week', 'day_name', 'start_time', 'end_time', 'is_available']

    def get_doctor_name(self, obj):
        return f"Dr. {obj.doctor.user.first_name} {obj.doctor.user.last_name}"

class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = '__all__'

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "Inconnu"

    def get_doctor_name(self, obj):
        return f"Dr. {obj.doctor.first_name} {obj.doctor.last_name}" if obj.doctor else "N/A"

class LabResultSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = LabResult
        fields = '__all__'

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "Inconnu"

class InvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}" if obj.patient else "Inconnu"
