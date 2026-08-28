from django.db import models
from django.conf import settings
from businesses.models import Business
import uuid


# ---------------------------------------------------------------------------
# 01.1 — RÉFÉRENTIEL DES ÉTABLISSEMENTS HOSPITALIERS
# Extension spécialisée du modèle générique Business pour les hôpitaux.
# Architecture OneToOne : Business conserve les champs communs à tous les
# secteurs (nom, adresse, contacts, géoloc) et HospitalProfile ajoute les
# champs propres au secteur santé (niveau, type, urgences, langues…).
# ---------------------------------------------------------------------------

class HospitalProfile(models.Model):
    """
    Fiche d'identité complète d'un hôpital — Module 01.1
    Extension OneToOne du modèle Business, spécifique au secteur santé.
    Conforme à la spécification : Module Hopital.txt — Section 2.
    """

    # --- Types d'établissement ---
    HOSPITAL_TYPE_CHOICES = (
        ('PUBLIC', 'Public'),
        ('PRIVATE', 'Privé'),
        ('FAITH_BASED', 'Confessionnel'),
        ('NGO', 'ONG / Humanitaire'),
        ('MILITARY', 'Militaire'),
        ('OTHER', 'Autre'),
    )

    # --- Statut opérationnel ---
    OPERATIONAL_STATUS_CHOICES = (
        ('ACTIVE', 'En activité'),
        ('TEMPORARILY_CLOSED', 'Temporairement fermé'),
        ('UNDER_RENOVATION', 'En rénovation'),
        ('CLOSED', 'Fermé définitivement'),
    )

    # --- Niveau de l'établissement (système de référencement burundais) ---
    LEVEL_CHOICES = (
        ('HEALTH_POST', 'Poste de santé'),
        ('HEALTH_CENTER', 'Centre de santé'),
        ('DISTRICT_HOSPITAL', 'Hôpital de district'),
        ('PROVINCIAL_HOSPITAL', 'Hôpital provincial'),
        ('NATIONAL_HOSPITAL', 'Hôpital national'),
        ('SPECIALIZED_HOSPITAL', 'Hôpital spécialisé'),
        ('CLINIC', 'Clinique privée'),
        ('POLYCLINIC', 'Polyclinique'),
    )

    # --- Niveau de référencement (vers qui peut-on référer les patients) ---
    REFERENCE_LEVEL_CHOICES = (
        ('LEVEL_1', 'Niveau 1 — Soins primaires'),
        ('LEVEL_2', 'Niveau 2 — Soins secondaires'),
        ('LEVEL_3', 'Niveau 3 — Soins tertiaires / Spécialisés'),
        ('LEVEL_4', 'Niveau 4 — Soins quaternaires / Super-spécialisés'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Lien OneToOne vers le modèle générique Business
    business = models.OneToOneField(
        Business,
        on_delete=models.CASCADE,
        related_name='hospital_profile',
        help_text="Référence vers la fiche Business générique de cet hôpital"
    )

    # --- Champs d'identité spécifiques à un hôpital ---
    acronym = models.CharField(
        max_length=20, blank=True, null=True,
        help_text="Sigle de l'établissement (ex: CHU, CHUK, HBB)"
    )
    hospital_type = models.CharField(
        max_length=20, choices=HOSPITAL_TYPE_CHOICES, default='PRIVATE',
        help_text="Type d'établissement (public, privé, confessionnel…)"
    )
    operational_status = models.CharField(
        max_length=30, choices=OPERATIONAL_STATUS_CHOICES, default='ACTIVE',
        help_text="Statut opérationnel actuel de l'établissement"
    )
    level = models.CharField(
        max_length=30, choices=LEVEL_CHOICES, default='CLINIC',
        help_text="Niveau de l'établissement dans la pyramide sanitaire"
    )
    reference_level = models.CharField(
        max_length=10, choices=REFERENCE_LEVEL_CHOICES, blank=True, null=True,
        help_text="Niveau auquel cet établissement peut recevoir les références"
    )

    # --- Disponibilité des services d'urgence ---
    emergency_available = models.BooleanField(
        default=False,
        help_text="Service d'urgences disponible 24h/24 — affiché sur la carte"
    )
    emergency_phone = models.CharField(
        max_length=50, blank=True, null=True,
        help_text="Numéro direct des urgences (peut différer du numéro principal)"
    )

    # --- Horaires d'ouverture structurés ---
    # Format JSON attendu :
    # { "lundi": {"open": "08:00", "close": "17:00", "closed": false},
    #   "samedi": {"open": "08:00", "close": "12:00", "closed": false},
    #   "dimanche": {"closed": true} }
    opening_hours = models.JSONField(
        default=dict, blank=True,
        help_text="Horaires par jour de la semaine (JSON structuré)"
    )

    # --- Langues disponibles dans l'établissement ---
    # Stockées sous forme de chaîne CSV pour simplicité (ex: "Français, Kirundi, Anglais")
    languages_available = models.CharField(
        max_length=300,
        default='Français, Kirundi',
        help_text="Langues parlées par le personnel (séparées par des virgules)"
    )

    # --- Accréditation & Agréments ---
    accreditation_number = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="Numéro d'agrément ministériel ou d'accréditation"
    )
    accreditation_body = models.CharField(
        max_length=200, blank=True, null=True,
        help_text="Organisme d'accréditation (ex: Ministère de la Santé du Burundi)"
    )
    accreditation_valid_until = models.DateField(
        null=True, blank=True,
        help_text="Date d'expiration de l'agrément"
    )

    # --- Capacité d'accueil ---
    bed_capacity = models.IntegerField(
        null=True, blank=True,
        help_text="Nombre de lits disponibles"
    )
    icu_beds = models.IntegerField(
        null=True, blank=True,
        help_text="Nombre de lits en soins intensifs (USI)"
    )

    # --- Télémédecine ---
    telemedicine_unit_available = models.BooleanField(
        default=False,
        help_text="L'hôpital dispose d'une unité physique de télémédecine"
    )
    telemedicine_unit_description = models.TextField(
        blank=True, null=True,
        help_text="Description de l'espace télémédecine (équipements, localisation…)"
    )

    # --- Assurances acceptées ---
    # Format JSON : ["MFPB", "INSS", "POLISY", "SANLAM"]
    accepted_insurances = models.JSONField(
        default=list, blank=True,
        help_text="Liste des compagnies d'assurance acceptées"
    )

    # --- Service clientèle 24/7 ---
    customer_service_phone = models.CharField(
        max_length=50, blank=True, null=True,
        help_text="Numéro dédié au service clientèle"
    )
    customer_service_whatsapp = models.CharField(
        max_length=50, blank=True, null=True,
        help_text="Numéro WhatsApp du service clientèle"
    )
    customer_service_email = models.EmailField(
        blank=True, null=True,
        help_text="Email dédié au service clientèle"
    )
    customer_service_available_24_7 = models.BooleanField(
        default=False,
        help_text="Service clientèle disponible 24h/24, 7j/7"
    )

    # --- Médias & Présentation ---
    cover_image_url = models.URLField(
        blank=True, null=True,
        help_text="Image de couverture de la page hôpital"
    )
    gallery_urls = models.JSONField(
        default=list, blank=True,
        help_text="Liste d'URLs des photos de l'établissement"
    )
    presentation_video_url = models.URLField(
        blank=True, null=True,
        help_text="URL de la vidéo de présentation (YouTube, Vimeo…)"
    )

    # --- Réseaux sociaux ---
    facebook_url = models.URLField(blank=True, null=True)
    twitter_url = models.URLField(blank=True, null=True)
    linkedin_url = models.URLField(blank=True, null=True)

    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Profil Hôpital"
        verbose_name_plural = "Profils Hôpitaux"
        ordering = ['business__name']

    def __str__(self):
        acronym_part = f" ({self.acronym})" if self.acronym else ""
        return f"{self.business.name}{acronym_part} — {self.get_level_display()}"

    @property
    def is_open_now(self):
        """Calcule si l'hôpital est ouvert en ce moment selon ses horaires."""
        from datetime import datetime
        now = datetime.now()
        day_names = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
        today_key = day_names[now.weekday()]
        day_schedule = self.opening_hours.get(today_key, {})
        if day_schedule.get('closed', False):
            return False
        open_time_str = day_schedule.get('open')
        close_time_str = day_schedule.get('close')
        if not open_time_str or not close_time_str:
            return None  # Horaires non renseignés
        try:
            open_time = datetime.strptime(open_time_str, '%H:%M').time()
            close_time = datetime.strptime(close_time_str, '%H:%M').time()
            return open_time <= now.time() <= close_time
        except ValueError:
            return None

    @property
    def display_type_level(self):
        """Affichage combiné type + niveau pour les cartes de résultats."""
        return f"{self.get_hospital_type_display()} — {self.get_level_display()}"

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

# ---------------------------------------------------------------------------
# 01.3 — ANNUAIRE DES PROFESSIONNELS DE SANTÉ
# Profil complet de chaque médecin/spécialiste.
# Conforme à la spécification : Module Hopital.txt — Section 4 et 12.
# ---------------------------------------------------------------------------

class DoctorProfile(models.Model):
    """
    Profil complet d'un médecin ou spécialiste — Module 01.3 & 01.11
    Couvre aussi bien les médecins locaux que les spécialistes de la diaspora.
    Conforme à Module Hopital.txt — Sections 4 et 12.
    """

    STAFF_CATEGORY_CHOICES = (
        ('SPECIALIST', 'Médecin Spécialiste'),
        ('DOCTOR', 'Docteur / Généraliste'),
        ('NURSE', 'Infirmier(e) / Soignant(e)'),
    )

    GENDER_CHOICES = (
        ('M', 'Masculin'),
        ('F', 'Féminin'),
        ('NB', 'Non précisé'),
    )

    # Titre professionnel affiché dans l'annuaire (sans "Dr." automatiqué)
    TITLE_CHOICES = (
        ('DR', 'Dr'),
        ('PR', 'Pr (Professeur)'),
        ('MG', 'Médecin Généraliste'),
        ('SPEC', 'Spécialiste'),
        ('SAGE_FEMME', 'Sage-femme'),
        ('INFIRMIER', 'Infirmier(e)'),
        ('PHARMACIEN', 'Pharmacien(ne)'),
        ('KINESITHERAPEUTE', 'Kinésithérapeute'),
        ('NUTRITIONNISTE', 'Nutritionniste'),
        ('PSYCHOLOGUE', 'Psychologue'),
        ('AUTRE', 'Autre professionnel de santé'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Compte utilisateur associé
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='doctor_profile'
    )

    # Établissement de rattachement principal
    hospital = models.ForeignKey(
        Business, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='doctors',
        help_text="Hôpital ou clinique de rattachement principal"
    )

    # Spécialités
    specialties = models.ManyToManyField(Specialty, related_name='doctors')
    services = models.ManyToManyField(
        'MedicalService', related_name='assigned_doctors', blank=True
    )
    sub_specialty = models.CharField(
        max_length=150, blank=True, null=True,
        help_text="Sous-spécialité (ex: Cardiologie Pédiatrique)"
    )

    # --- Identité professionnelle ---
    staff_category = models.CharField(
        max_length=20, choices=STAFF_CATEGORY_CHOICES, default='DOCTOR',
        help_text="Catégorie du personnel : Médecin Spécialiste, Docteur/Généraliste, ou Infirmier(e)"
    )
    professional_title = models.CharField(
        max_length=20, choices=TITLE_CHOICES, default='DR',
        help_text="Titre professionnel affiché dans l'annuaire"
    )
    gender = models.CharField(
        max_length=10, choices=GENDER_CHOICES, blank=True, null=True
    )
    medical_license_number = models.CharField(
        max_length=100, unique=True,
        help_text="Numéro d'ordre professionnel (Ordre des Médecins du Burundi)"
    )
    languages_spoken = models.CharField(
        max_length=200, default="Français, Kirundi",
        help_text="Langues parlées (séparées par des virgules)"
    )
    qualifications = models.TextField(
        blank=True, null=True,
        help_text="Diplômes, formations et qualifications"
    )
    experience_years = models.IntegerField(
        default=5, help_text="Années d'expérience professionnelle"
    )
    bio = models.TextField(
        blank=True, null=True,
        help_text="Biographie courte visible par le patient"
    )
    photo_url = models.URLField(
        blank=True, null=True,
        help_text="URL de la photo professionnelle du médecin"
    )

    # --- Modes de consultation ---
    is_physical_consultation = models.BooleanField(
        default=True,
        help_text="Le médecin reçoit des patients en présentiel"
    )
    is_available_for_telemedicine = models.BooleanField(
        default=False,
        help_text="Le médecin est disponible pour des téléconsultations"
    )
    is_available_for_tele_expertise = models.BooleanField(
        default=False,
        help_text="Le médecin peut fournir un avis de télé-expertise à d'autres médecins"
    )

    # --- Disponibilité ---
    is_active = models.BooleanField(
        default=True,
        help_text="Décocher pour masquer le médecin du répertoire sans supprimer son profil"
    )
    is_accepting_new_patients = models.BooleanField(
        default=True,
        help_text="Le médecin accepte de nouveaux patients"
    )

    # --- Tarification ---
    consultation_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00,
        help_text="Tarif de consultation"
    )
    consultation_fee_currency = models.CharField(
        max_length=10, default='BIF',
        help_text="Devise du tarif (BIF, USD, EUR…)"
    )
    accepted_payment_methods = models.CharField(
        max_length=200, default="Espèces, Mobile Money, Carte Bancaire",
        help_text="Méthodes de paiement acceptées"
    )

    # --- Profil diaspora (Module 01.11) ---
    is_diaspora = models.BooleanField(
        default=False,
        help_text="Ce médecin fait partie du réseau des spécialistes à distance (diaspora)"
    )
    diaspora_country = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="Pays de résidence du médecin diaspora"
    )
    diaspora_timezone = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="Fuseau horaire du médecin diaspora (ex: Europe/Paris, America/New_York)"
    )
    diaspora_institution = models.CharField(
        max_length=200, blank=True, null=True,
        help_text="Établissement de rattachement à l'étranger"
    )
    diaspora_verification_status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Candidature en attente'),
            ('UNDER_REVIEW', 'Documents en vérification'),
            ('VALIDATED', 'Validé'),
            ('ACTIVE', 'Actif'),
            ('SUSPENDED', 'Suspendu'),
        ],
        default='PENDING',
        help_text="Statut de vérification du médecin diaspora"
    )
    tele_expertise_count = models.IntegerField(
        default=0,
        help_text="Nombre de télé-expertises réalisées sur la plateforme"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Profil Médecin"
        verbose_name_plural = "Profils Médecins"
        ordering = ['user__last_name', 'user__first_name']

    def __str__(self):
        title = self.get_professional_title_display()
        return f"{title} {self.user.get_full_name()} ({self.medical_license_number})"

    @property
    def full_display_name(self):
        """Nom complet sans préfixe automatique 'Dr.' — conforme à la politique Isoko Hub."""
        return self.user.get_full_name()

    @property
    def formatted_fee(self):
        """Tarif formaté pour l'affichage."""
        if self.consultation_fee == 0:
            return "Tarif à définir"
        return f"{self.consultation_fee:,.0f} {self.consultation_fee_currency}"

    @property
    def consultation_modes(self):
        """Modes de consultation disponibles (liste pour l'affichage)."""
        modes = []
        if self.is_physical_consultation:
            modes.append('Consultation physique')
        if self.is_available_for_telemedicine:
            modes.append('Téléconsultation')
        if self.is_available_for_tele_expertise:
            modes.append('Télé-expertise')
        return modes



# ---------------------------------------------------------------------------
# 01.5 — MODULE RENDEZ-VOUS
# Workflow complet de prise et gestion de rendez-vous.
# Conforme à la spécification : Module Hopital.txt — Sections 5 et 13.
# ---------------------------------------------------------------------------

class Appointment(models.Model):
    """
    Rendez-vous médical — Module 01.5
    Workflow : PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
                              └→ RESCHEDULED → CONFIRMED
                              └→ CANCELLED
    Conforme à Module Hopital.txt — Section 5.
    """

    STATUS_CHOICES = (
        ('PENDING', 'En attente de confirmation'),
        ('CONFIRMED', 'Confirmé'),
        ('IN_PROGRESS', 'En cours'),
        ('COMPLETED', 'Terminé'),
        ('RESCHEDULED', 'Reprogrammé'),
        ('CANCELLED', 'Annulé'),
        ('NO_SHOW', 'Patient absent'),
    )

    TYPE_CHOICES = (
        ('IN_PERSON', 'En présentiel'),
        ('TELEMEDICINE', 'Téléconsultation'),
        ('TELE_EXPERTISE', 'Télé-expertise (entre médecins)'),
    )

    # Transitions de statut valides (workflow)
    VALID_TRANSITIONS = {
        'PENDING': ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED': ['IN_PROGRESS', 'RESCHEDULED', 'CANCELLED'],
        'IN_PROGRESS': ['COMPLETED', 'NO_SHOW'],
        'RESCHEDULED': ['CONFIRMED', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': [],
        'NO_SHOW': [],
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Parties prenantes
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='patient_appointments'
    )
    doctor = models.ForeignKey(
        DoctorProfile, on_delete=models.CASCADE, related_name='appointments'
    )
    hospital = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='appointments'
    )

    # Date et type
    appointment_date = models.DateTimeField(
        help_text="Date et heure du rendez-vous"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING'
    )
    consultation_type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default='IN_PERSON'
    )

    # Informations cliniques
    reason = models.TextField(
        blank=True, null=True,
        help_text="Motif de la consultation"
    )
    notes = models.TextField(
        blank=True, null=True,
        help_text="Notes cliniques post-consultation (remplies par le médecin)"
    )

    # Géolocalisation du RDV (pour les RDV à domicile ou en déplacement)
    location_notes = models.CharField(
        max_length=300, blank=True, null=True,
        help_text="Précisions sur le lieu (salle, étage, building…)"
    )

    # --- Téléconsultation ---
    telemedicine_link = models.URLField(
        blank=True, null=True,
        help_text="Lien de la salle de téléconsultation (généré automatiquement)"
    )
    telemedicine_room_id = models.CharField(
        max_length=200, blank=True, null=True,
        help_text="Identifiant de salle (Jitsi / Daily.co / autre)"
    )

    # --- Reprogrammation ---
    rescheduled_to = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='rescheduled_from',
        help_text="Nouveau rendez-vous créé lors d'une reprogrammation"
    )
    cancellation_reason = models.TextField(
        blank=True, null=True,
        help_text="Motif d'annulation ou de reprogrammation"
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cancelled_appointments',
        help_text="Utilisateur ayant annulé le rendez-vous"
    )

    # --- Suivi des notifications (Module 01.5) ---
    # Permet de ne pas envoyer deux fois le même rappel
    reminder_24h_sent = models.BooleanField(
        default=False,
        help_text="Rappel 24h avant envoyé"
    )
    reminder_1h_sent = models.BooleanField(
        default=False,
        help_text="Rappel 1h avant envoyé"
    )

    # --- Dates clés du workflow ---
    confirmed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Date de confirmation du rendez-vous"
    )
    completed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Date de clôture du rendez-vous"
    )
    cancelled_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Date d'annulation"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Rendez-vous"
        verbose_name_plural = "Rendez-vous"
        ordering = ['-appointment_date']
        indexes = [
            models.Index(fields=['patient', 'status'], name='idx_appt_patient_status'),
            models.Index(fields=['doctor', 'appointment_date'], name='idx_appt_doctor_date'),
            models.Index(fields=['hospital', 'status'], name='idx_appt_hospital_status'),
            models.Index(
                fields=['appointment_date', 'reminder_24h_sent'],
                name='idx_appt_reminder_24h'
            ),
        ]

    def __str__(self):
        return (
            f"RDV [{self.get_status_display()}] — "
            f"{self.patient.get_full_name()} → "
            f"{self.doctor.user.get_full_name()} — "
            f"{self.appointment_date.strftime('%Y-%m-%d %H:%M')}"
        )

    def can_transition_to(self, new_status):
        """Vérifie si la transition de statut est valide selon le workflow défini."""
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])

    def confirm(self, save=True):
        """Confirme le rendez-vous et enregistre la date de confirmation."""
        from django.utils import timezone
        if self.can_transition_to('CONFIRMED'):
            self.status = 'CONFIRMED'
            self.confirmed_at = timezone.now()
            if save:
                self.save(update_fields=['status', 'confirmed_at', 'updated_at'])
            return True
        return False

    def complete(self, notes=None, save=True):
        """Clôture le rendez-vous comme terminé."""
        from django.utils import timezone
        if self.can_transition_to('COMPLETED'):
            self.status = 'COMPLETED'
            self.completed_at = timezone.now()
            if notes:
                self.notes = notes
            if save:
                self.save(update_fields=['status', 'completed_at', 'notes', 'updated_at'])
            return True
        return False

    def cancel(self, reason=None, cancelled_by=None, save=True):
        """Annule le rendez-vous avec motif et responsable."""
        from django.utils import timezone
        if self.can_transition_to('CANCELLED'):
            self.status = 'CANCELLED'
            self.cancelled_at = timezone.now()
            if reason:
                self.cancellation_reason = reason
            if cancelled_by:
                self.cancelled_by = cancelled_by
            if save:
                self.save(
                    update_fields=[
                        'status', 'cancelled_at', 'cancellation_reason',
                        'cancelled_by', 'updated_at'
                    ]
                )
            return True
        return False



# ---------------------------------------------------------------------------
# 01.2 — SERVICES & PAQUETS DE SOINS
# Base de données structurée des services médicaux offerts par chaque hôpital.
# Conforme à la spécification : Module Hopital.txt — Section 3.
# ---------------------------------------------------------------------------

class MedicalService(models.Model):
    """
    Service médical ou paquet de soins offert par un hôpital — Module 01.2
    Chaque service est une entrée indépendante, pas un simple texte libre.
    Cela permet le filtrage, la recherche, l'affichage structuré et la tarification.
    Conforme à Module Hopital.txt — Section 3.
    """

    # --- Catégorie principale du service ---
    CATEGORY_CHOICES = (
        ('GENERAL', 'Service Général'),
        ('SPECIALIZED', 'Service Spécialisé'),
        ('CARE_PACKAGE', 'Paquet de Soins'),
        ('DIAGNOSTIC', 'Diagnostic & Imagerie'),
        ('SURGICAL', 'Chirurgie'),
        ('EMERGENCY', 'Urgences'),
        ('MATERNITY', 'Maternité & Obstétrique'),
        ('PEDIATRIC', 'Pédiatrie'),
        ('REHABILITATION', 'Rééducation & Kinésithérapie'),
        ('PHARMACY', 'Pharmacie'),
        ('TELEMEDICINE', 'Télémédecine'),
    )

    # --- Type détaillé de service (catalogue OMS-inspiré) ---
    SERVICE_TYPE_CHOICES = (
        # Médecine générale
        ('INTERNAL_MEDICINE', 'Médecine interne'),
        ('GENERAL_SURGERY', 'Chirurgie générale'),
        ('PEDIATRICS', 'Pédiatrie'),
        ('OBSTETRICS_GYNECOLOGY', 'Gynécologie-Obstétrique'),
        ('EMERGENCY', 'Urgences'),
        ('MATERNITY', 'Maternité'),
        ('DENTISTRY', 'Dentisterie'),
        # Spécialités médicales
        ('CARDIOLOGY', 'Cardiologie'),
        ('NEUROLOGY', 'Neurologie'),
        ('NEPHROLOGY', 'Néphrologie'),
        ('ONCOLOGY', 'Oncologie'),
        ('ORTHOPEDICS', 'Orthopédie'),
        ('OPHTHALMOLOGY', 'Ophtalmologie'),
        ('DERMATOLOGY', 'Dermatologie'),
        ('PSYCHIATRY', 'Psychiatrie'),
        ('PULMONOLOGY', 'Pneumologie'),
        ('GASTROENTEROLOGY', 'Gastroentérologie'),
        ('ENDOCRINOLOGY', 'Endocrinologie'),
        ('RHEUMATOLOGY', 'Rhumatologie'),
        ('UROLOGY', 'Urologie'),
        ('ENT', 'ORL (Oto-rhino-laryngologie)'),
        ('HEMATOLOGY', 'Hématologie'),
        ('INFECTIOUS_DISEASE', 'Maladies infectieuses'),
        # Diagnostic & imagerie
        ('RADIOLOGY', 'Radiologie'),
        ('ECHOGRAPHY', 'Échographie'),
        ('SCANNER_MRI', 'Scanner / IRM'),
        ('LABORATORY', 'Analyses de laboratoire'),
        # Chirurgie spécialisée
        ('CARDIAC_SURGERY', 'Chirurgie cardiaque'),
        ('NEUROSURGERY', 'Neurochirurgie'),
        ('PLASTIC_SURGERY', 'Chirurgie plastique'),
        ('VASCULAR_SURGERY', 'Chirurgie vasculaire'),
        # Autres
        ('PHYSIOTHERAPY', 'Kinésithérapie'),
        ('NUTRITION', 'Nutrition & Diététique'),
        ('PSYCHOLOGY', 'Psychologie'),
        ('PALLIATIVE_CARE', 'Soins palliatifs'),
        ('BLOOD_BANK', 'Banque de sang'),
        ('VACCINATION', 'Vaccination & Prévention'),
        ('OTHER', 'Autre'),
    )

    # --- Disponibilité du service ---
    AVAILABILITY_CHOICES = (
        ('H24_7', '24h/24 — 7j/7'),
        ('BUSINESS_HOURS', 'Heures ouvrables uniquement'),
        ('BY_APPOINTMENT', 'Sur rendez-vous'),
        ('MORNING_ONLY', 'Matin uniquement'),
        ('AFTERNOON_ONLY', 'Après-midi uniquement'),
        ('SPECIFIC_DAYS', 'Jours spécifiques (voir horaires)'),
        ('TEMPORARILY_UNAVAILABLE', 'Temporairement indisponible'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Lien vers l'hôpital
    hospital = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='medical_services',
        help_text="Hôpital ou établissement proposant ce service"
    )

    # Classification
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='GENERAL',
        help_text="Catégorie principale du service"
    )
    service_type = models.CharField(
        max_length=30, choices=SERVICE_TYPE_CHOICES, default='OTHER',
        help_text="Type précis du service (utilisé pour les filtres et la recherche)"
    )

    # Informations de base
    name = models.CharField(
        max_length=150,
        help_text="Nom du service tel qu'affiché au patient"
    )
    description = models.TextField(
        blank=True, null=True,
        help_text="Description détaillée du service et de ce qu'il couvre"
    )

    # Responsable du service
    head_doctor = models.ForeignKey(
        DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='headed_services',
        help_text="Médecin responsable du service"
    )

    # Contact direct du service
    contact_phone = models.CharField(
        max_length=50, blank=True, null=True,
        help_text="Numéro de contact direct du service (peut différer du numéro principal)"
    )
    contact_email = models.EmailField(
        blank=True, null=True,
        help_text="Email direct du service"
    )

    # Disponibilité et horaires
    availability = models.CharField(
        max_length=30, choices=AVAILABILITY_CHOICES, default='BY_APPOINTMENT',
        help_text="Disponibilité générale du service"
    )
    # Horaires structurés par jour (format JSON identique à HospitalProfile.opening_hours)
    operating_hours = models.JSONField(
        default=dict, blank=True,
        help_text="Horaires détaillés par jour. Ex: {\"lundi\": {\"open\": \"08:00\", \"close\": \"17:00\"}}"
    )

    # Tarification
    indicative_cost = models.DecimalField(
        max_digits=12, decimal_places=2, default=0.00,
        help_text="Coût indicatif en BIF (0 = gratuit ou à définir)"
    )
    currency = models.CharField(
        max_length=10, default='BIF',
        help_text="Devise utilisée pour le tarif (BIF, USD, EUR…)"
    )
    cost_notes = models.CharField(
        max_length=300, blank=True, null=True,
        help_text="Note sur le tarif (ex: 'Tarif réduit pour les assurés INSS')"
    )

    # Conditions d'accès
    access_conditions = models.TextField(
        blank=True, null=True, default='Sur Rendez-vous',
        help_text="Conditions d'accès au service (prescription requise, référencement, etc.)"
    )

    # Options numériques
    telemedicine_available = models.BooleanField(
        default=False,
        help_text="Ce service peut être consulté à distance via télémédecine"
    )
    online_booking_available = models.BooleanField(
        default=True,
        help_text="La prise de rendez-vous en ligne est disponible pour ce service"
    )

    # Statut
    is_active = models.BooleanField(
        default=True,
        help_text="Décocher pour masquer ce service sans le supprimer"
    )

    # Ordre d'affichage dans la liste
    display_order = models.IntegerField(
        default=0,
        help_text="Ordre d'affichage (plus petit = affiché en premier)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Service Médical"
        verbose_name_plural = "Services Médicaux"
        ordering = ['display_order', 'category', 'name']
        indexes = [
            models.Index(fields=['hospital', 'is_active'], name='idx_service_hospital_active'),
            models.Index(fields=['category', 'service_type'], name='idx_service_cat_type'),
        ]

    def __str__(self):
        return f"[{self.get_category_display()}] {self.name} — {self.hospital.name}"

    @property
    def formatted_cost(self):
        """Retourne le tarif formaté pour l'affichage."""
        if self.indicative_cost == 0:
            return "Tarif à définir"
        return f"{self.indicative_cost:,.0f} {self.currency}"

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
