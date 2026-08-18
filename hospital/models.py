from django.db import models
from django.conf import settings
from businesses.models import Business
import uuid

class Specialty(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Specialties"

class DoctorProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doctor_profile')
    hospital = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True, related_name='doctors')
    specialties = models.ManyToManyField(Specialty, related_name='doctors')
    medical_license_number = models.CharField(max_length=100, unique=True)
    bio = models.TextField(blank=True, null=True)
    is_available_for_telemedicine = models.BooleanField(default=False)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dr. {self.user.get_full_name()} - {self.medical_license_number}"

class Appointment(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('CONFIRMED', 'Confirmé'),
        ('COMPLETED', 'Terminé'),
        ('CANCELLED', 'Annulé'),
    )
    
    TYPE_CHOICES = (
        ('IN_PERSON', 'En présentiel'),
        ('TELEMEDICINE', 'Téléconsultation'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patient_appointments')
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='appointments')
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='appointments')
    appointment_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    consultation_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='IN_PERSON')
    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Appointment: {self.patient.get_full_name()} with Dr. {self.doctor.user.get_full_name()} on {self.appointment_date.strftime('%Y-%m-%d %H:%M')}"

class MedicalService(models.Model):
    """Départements ou services offerts par l'hôpital (ex: Urgences, Maternité)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='medical_services')
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.hospital.name}"

class DoctorSchedule(models.Model):
    """Horaires de disponibilité d'un médecin dans un hôpital spécifique"""
    DAYS_OF_WEEK = (
        (0, 'Lundi'), (1, 'Mardi'), (2, 'Mercredi'),
        (3, 'Jeudi'), (4, 'Vendredi'), (5, 'Samedi'), (6, 'Dimanche'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='schedules')
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='doctor_schedules')
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)

    class Meta:
        unique_together = ('doctor', 'hospital', 'day_of_week')

    def __str__(self):
        return f"{self.doctor.user.get_full_name()} - {self.get_day_of_week_display()} ({self.start_time} - {self.end_time})"

class MedicalRecord(models.Model):
    """Dossier médical et notes cliniques d'un patient. Isolation par hôpital."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='medical_records')
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='medical_records')
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, related_name='created_records')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='medical_records')
    
    diagnosis = models.CharField(max_length=255, blank=True, null=True)
    clinical_notes = models.TextField(blank=True, null=True)
    prescription = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Record for {self.patient.get_full_name()} at {self.hospital.name}"

class LabResult(models.Model):
    """Résultats d'examens de laboratoire."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lab_results')
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='lab_results')
    ordered_by = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='ordered_labs')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='uploaded_labs')
    
    test_name = models.CharField(max_length=200)
    result_notes = models.TextField(blank=True, null=True)
    document_url = models.URLField(blank=True, null=True, help_text="Lien vers le fichier PDF du résultat")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Lab: {self.test_name} - {self.patient.get_full_name()}"

class Invoice(models.Model):
    """Facturation des actes médicaux et consultations."""
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('PAID', 'Payée'),
        ('CANCELLED', 'Annulée'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invoices')
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='invoices')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    issued_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f"Invoice {self.id} - {self.patient.get_full_name()} - {self.amount} BIF"
