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
    GENDER_CHOICES = (
        ('M', 'Masculin'),
        ('F', 'Féminin'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doctor_profile')
    hospital = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True, related_name='doctors')
    specialties = models.ManyToManyField(Specialty, related_name='doctors')
    services = models.ManyToManyField('MedicalService', related_name='assigned_doctors', blank=True)
    sub_specialty = models.CharField(max_length=150, blank=True, null=True, help_text="Sous-spécialité (ex: Cardiologie Pédiatrique)")
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    medical_license_number = models.CharField(max_length=100, unique=True)
    languages_spoken = models.CharField(max_length=200, default="Français, Kirundi", help_text="Langues parlées")
    qualifications = models.TextField(blank=True, null=True, help_text="Qualifications et diplômes")
    experience_years = models.IntegerField(default=5, help_text="Années d'expérience professionnelle")
    accepted_payment_methods = models.CharField(max_length=200, default="Espèces, Mobile Money, Carte Bancaire")
    photo_url = models.URLField(blank=True, null=True, help_text="Photo professionnelle du médecin")
    bio = models.TextField(blank=True, null=True)
    is_available_for_telemedicine = models.BooleanField(default=False)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.medical_license_number}"

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
        return f"Appointment: {self.patient.get_full_name()} with {self.doctor.user.get_full_name()} on {self.appointment_date.strftime('%Y-%m-%d %H:%M')}"

class MedicalService(models.Model):
    """
    Service médical / Paquet de soins offert par un hôpital (Conforme à Module Hopital.dotx - Section 3)
    """
    CATEGORY_CHOICES = (
        ('GENERAL', 'Service Général'),
        ('SPECIALIZED', 'Service Spécialisé'),
        ('CARE_PACKAGE', 'Paquet de Soins'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='medical_services')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='GENERAL')
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    head_doctor = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='headed_services')
    contact_phone = models.CharField(max_length=50, blank=True, null=True)
    operating_hours = models.CharField(max_length=150, blank=True, null=True, default='24h/24, 7j/7')
    indicative_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    access_conditions = models.TextField(blank=True, null=True, default='Sur Rendez-vous')
    telemedicine_available = models.BooleanField(default=False)
    online_booking_available = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.get_category_display()}] {self.name} - {self.hospital.name}"

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
    """Résultats d'examens de laboratoire avec workflow de sécurité élevée."""
    STATUS_CHOICES = (
        ('REQUESTED', 'Demandé'),
        ('SAMPLE_COLLECTED', 'Prélèvement effectué'),
        ('IN_ANALYSIS', 'En analyse'),
        ('RESULT_AVAILABLE', 'Résultat disponible'),
        ('VALIDATED', 'Validé'),
        ('COMMUNICATED', 'Communiqué'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lab_results')
    hospital = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='lab_results')
    ordered_by = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='ordered_labs')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='uploaded_labs')
    validated_by = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_labs')
    
    test_name = models.CharField(max_length=200, help_text="Nom de l'examen")
    test_date = models.DateField(help_text="Date de l'examen")
    result_value = models.CharField(max_length=500, help_text="Valeur du résultat")
    unit = models.CharField(max_length=50, blank=True, help_text="Unité de mesure")
    reference_values = models.TextField(blank=True, help_text="Valeurs de référence normales")
    result_notes = models.TextField(blank=True, help_text="Commentaires sur le résultat")
    document_url = models.URLField(blank=True, null=True, help_text="Lien vers le fichier PDF du résultat")
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='REQUESTED')
    
    validation_date = models.DateTimeField(null=True, blank=True, help_text="Date de validation du résultat")
    communication_date = models.DateTimeField(null=True, blank=True, help_text="Date de communication au patient")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Résultat de laboratoire"
        verbose_name_plural = "Résultats de laboratoire"

    def __str__(self):
        return f"Lab: {self.test_name} - {self.patient.get_full_name()} ({self.get_status_display()})"

class Notification(models.Model):
    """Notifications pour les patients (résultats de laboratoire, rappels, etc.)."""
    NOTIFICATION_TYPES = (
        ('LAB_RESULT', 'Résultat de laboratoire'),
        ('APPOINTMENT_REMINDER', 'Rappel de rendez-vous'),
        ('PRESCRIPTION_READY', 'Prescription prête'),
        ('INVOICE_PAYMENT', 'Facture à payer'),
        ('GENERAL', 'Information générale'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES, default='GENERAL')
    
    title = models.CharField(max_length=200)
    message = models.TextField()
    
    # Lien vers l'objet concerné (optionnel)
    lab_result = models.ForeignKey('LabResult', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    appointment = models.ForeignKey('Appointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"{self.title} - {self.user.email}"

class Prescription(models.Model):
    """Prescriptions médicales et examens demandés par les médecins."""
    PRESCRIPTION_TYPE_CHOICES = (
        ('MEDICATION', 'Médicament'),
        ('EXAM', 'Examen'),
        ('PROCEDURE', 'Procédure'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Patient concerné
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='prescriptions')
    
    # Médecin prescripteur
    doctor = models.ForeignKey('DoctorProfile', on_delete=models.CASCADE, related_name='prescriptions')
    
    # Hôpital
    hospital = models.ForeignKey('businesses.Business', on_delete=models.CASCADE, related_name='prescriptions')
    
    # Type de prescription
    prescription_type = models.CharField(max_length=20, choices=PRESCRIPTION_TYPE_CHOICES)
    
    # Détails de la prescription
    medication_name = models.CharField(max_length=255, blank=True, help_text="Nom du médicament")
    dosage = models.CharField(max_length=100, blank=True, help_text="Dosage (ex: 500mg)")
    frequency = models.CharField(max_length=100, blank=True, help_text="Fréquence (ex: 3 fois par jour)")
    duration = models.CharField(max_length=100, blank=True, help_text="Durée (ex: 7 jours)")
    instructions = models.TextField(blank=True, help_text="Instructions spéciales")
    
    # Pour les examens
    exam_name = models.CharField(max_length=255, blank=True, help_text="Nom de l'examen")
    exam_reason = models.TextField(blank=True, help_text="Raison de l'examen")
    
    # Statut
    is_active = models.BooleanField(default=True)
    is_dispensed = models.BooleanField(default=False, help_text="Médicament délivré")
    is_completed = models.BooleanField(default=False, help_text="Examen complété")
    
    # Dates
    prescribed_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateField(null=True, blank=True, help_text="Date de validité de l'ordonnance")
    
    class Meta:
        ordering = ['-prescribed_at']
        verbose_name = "Prescription"
        verbose_name_plural = "Prescriptions"
    
    def __str__(self):
        if self.prescription_type == 'MEDICATION':
            return f"Ordonnance: {self.medication_name} - {self.patient.email}"
        elif self.prescription_type == 'EXAM':
            return f"Examen: {self.exam_name} - {self.patient.email}"
        return f"Prescription {self.id} - {self.patient.email}"

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
