"""Module Éducation — référentiel des établissements d'enseignement.

P0 : annuaire public (fiche établissement + fiche formation).
Rien n'est dupliqué depuis les autres modules : l'établissement reste un
`Business`, la localisation aussi, et l'abonnement SaaS est celui existant.
"""

import secrets
import uuid

from django.db import models
from django.utils import timezone


class PublicationStatus(models.TextChoices):
    """Cycle de validation publique. Seul `PUBLISHED` est visible sans compte."""

    DRAFT = 'DRAFT', 'Brouillon'
    SUBMITTED = 'SUBMITTED', 'Soumis à modération'
    PUBLISHED = 'PUBLISHED', 'Publié'
    REJECTED = 'REJECTED', 'Refusé'


class EducationProfile(models.Model):
    """Fiche institutionnelle d'un établissement — OneToOne du `Business`.

    L'adresse, le téléphone, le logo et la localisation restent sur `Business` :
    on ne les duplique pas.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        'businesses.Business',
        on_delete=models.CASCADE,
        related_name='education_profile',
    )

    # --- Statut opérationnel ---
    OPERATIONAL_STATUS_CHOICES = (
        ('ACTIVE', 'En activité'),
        ('ENROLLMENT_OPEN', 'Inscriptions ouvertes'),
        ('ENROLLMENT_CLOSED', 'Inscriptions fermées'),
        ('TEMPORARILY_CLOSED', 'Temporairement fermé'),
        ('CLOSED', 'Fermé définitivement'),
    )
    operational_status = models.CharField(
        max_length=32, choices=OPERATIONAL_STATUS_CHOICES, default='ACTIVE',
    )

    # --- Type d'établissement (aligné sur les 4 enfants de la catégorie) ---
    ESTABLISHMENT_TYPE_CHOICES = (
        ('UNIVERSITY', 'Université'),
        ('SCHOOL', 'École'),
        ('TRAINING_CENTER', 'Centre de formation'),
        ('PRIVATE_LESSONS', 'Cours particuliers'),
        ('OTHER', 'Autre'),
    )
    establishment_type = models.CharField(
        max_length=32, choices=ESTABLISHMENT_TYPE_CHOICES, blank=True, default='',
    )

    # --- Validation publique ---
    publication_status = models.CharField(
        max_length=16,
        choices=PublicationStatus.choices,
        default=PublicationStatus.DRAFT,
    )
    published_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    moderation_note = models.TextField(blank=True, default='')

    # --- Contenu éditorial propre au module ---
    history = models.TextField(blank=True, default='', verbose_name='Historique')
    teaching_languages = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Langues d’enseignement, séparées par des virgules.',
    )
    website = models.URLField(blank=True, default='')
    institutional_email = models.EmailField(blank=True, default='')
    short_description = models.TextField(
        blank=True, default='', verbose_name='Présentation courte',
    )
    official_name = models.CharField(
        max_length=255, blank=True, default='',
        verbose_name='Nom officiel',
        help_text='Dénomination légale, si elle diffère du nom commercial.',
    )
    description = models.TextField(
        blank=True, default='', verbose_name='Description détaillée',
    )
    # Galerie : le `logo` de `Business` reste la vignette de l'annuaire.
    gallery = models.JSONField(
        default=list, blank=True,
        help_text='URLs des photos du campus, de la bibliothèque, des salles.',
    )
    # Services aux étudiants (doc §3) : liste de {label, description}.
    student_services = models.JSONField(
        default=list, blank=True, verbose_name='Services aux étudiants',
    )
    academic_calendar = models.TextField(
        blank=True, default='', verbose_name='Organisation de l’année académique',
    )
    nearby_landmarks = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Quartiers ou zones de référence à proximité, séparés par des virgules.',
    )
    year_start = models.DateField(null=True, blank=True, verbose_name='Rentrée')
    year_break_start = models.DateField(null=True, blank=True, verbose_name='Début de pause')
    year_break_end = models.DateField(null=True, blank=True, verbose_name='Fin de pause')
    year_exam_start = models.DateField(null=True, blank=True, verbose_name='Début des examens')
    year_deliberation = models.DateField(null=True, blank=True, verbose_name='Délibération')
    library_hours = models.CharField(max_length=200, blank=True, default='')
    library_access = models.CharField(max_length=255, blank=True, default='')
    library_contact = models.CharField(max_length=200, blank=True, default='')
    internship_required = models.BooleanField(default=False)
    internship_duration = models.CharField(max_length=120, blank=True, default='')
    internship_period = models.CharField(max_length=120, blank=True, default='')
    internship_contact = models.CharField(max_length=200, blank=True, default='')

    # --- Particularités en champs structurés, pas un bloc de texte ---
    has_scholarships = models.BooleanField(default=False, verbose_name='Bourses')
    has_boarding = models.BooleanField(default=False, verbose_name='Internat')
    BOARDING_REGIME_CHOICES = (
        ('INTERNAT', 'Internat — filles et garçons logés'),
        ('EXTERNE', 'Externe — tout le monde rentre chez soi'),
        ('MIXTE', 'Mixte — internes et externes'),
        ('FILLES_INTERNES', 'Internat pour les filles, garçons externes'),
        ('GARCONS_INTERNES', 'Internat pour les garçons, filles externes'),
    )
    boarding_regime = models.CharField(
        max_length=32, choices=BOARDING_REGIME_CHOICES, blank=True, default='',
        verbose_name='Régime',
        help_text='Internat, externe, mixte, ou internat réservé aux filles ou aux garçons.',
    )
    has_campus = models.BooleanField(default=False, verbose_name='Campus')
    has_evening_courses = models.BooleanField(default=False, verbose_name='Cours du soir')
    has_distance_learning = models.BooleanField(default=False, verbose_name='Cours à distance')

    PARTICULARITY_FIELDS = (
        ('has_scholarships', 'Bourses d\'études'),
        ('has_boarding', 'Internat'),
        ('has_campus', 'Campus'),
        ('has_evening_courses', 'Cours du soir'),
        ('has_distance_learning', 'Cours à distance'),
    )

    # --- University-specific fields ---
    research_focus = models.TextField(
        blank=True, default='', verbose_name='Domaines de recherche',
        help_text='Principaux axes de recherche de l\'université.',
    )
    has_research_centers = models.BooleanField(
        default=False, verbose_name='Centres de recherche',
    )
    partner_universities = models.JSONField(
        default=list, blank=True, verbose_name='Universités partenaires',
        help_text='Liste de {name, country, agreement_type, since_year}.',
    )
    accreditation_level = models.CharField(
        max_length=32, blank=True, default='',
        choices=(
            ('NATIONAL', 'Nationale (MESRS)'),
            ('REGIONAL', 'Régionale (CAMES, IUCEA)'),
            ('INTERNATIONAL', 'Internationale (HCERES, AACSB, etc.)'),
        ),
        verbose_name='Niveau d\'accréditation',
    )
    student_population = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='Population étudiante',
        help_text='Nombre total d\'étudiants inscrits.',
    )
    faculty_count = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='Nombre d\'enseignants',
        help_text='Enseignants permanents (équivalent temps plein).',
    )
    founding_year = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='Année de fondation',
    )
    motto = models.CharField(
        max_length=200, blank=True, default='', verbose_name='Devise',
    )

    # Parcours de l'école burundaise. Une école peut offrir l'un, l'autre, ou les deux.
    ECOFO_CYCLE_CHOICES = (
        ('C1', '1er cycle — 1ère et 2ème années'),
        ('C2', '2e cycle — 3ème et 4ème années'),
        ('C3', '3e cycle — 5ème et 6ème années'),
        ('C4', '4e cycle — 7ème, 8ème et 9ème années'),
    )
    POST_ORIENTATION_CHOICES = (
        ('GENERAL', 'Général'),
        ('PEDAGOGIQUE', 'Pédagogique'),
        ('TECHNIQUE', 'Technique'),
    )
    POST_HUMANITIES = ('Lettres', 'Sciences', 'Sciences économiques')
    POST_TECHNIQUE_OPTIONS = ('Agriculture', 'Élevage', 'Électromécanique', 'Informatique')
    offers_prescolaire = models.BooleanField(
        default=False, verbose_name='Enseignement préscolaire',
    )
    offers_ecofo = models.BooleanField(default=False, verbose_name='École fondamentale (ECOFO)')
    offers_post_fondamental = models.BooleanField(default=False, verbose_name='Post-fondamental')
    # Legacy : cycles C1–C4 (conservé pour compat / inscription).
    ecofo_cycles = models.JSONField(default=list, blank=True)
    # Classes ECOFO gérées en CRUD par l'admin : [{value, label}, ...].
    ecofo_classes = models.JSONField(
        default=list, blank=True,
        verbose_name='Classes ECOFO',
        help_text='Liste dynamique des classes (ex. 1ère année, 2ème année…).',
    )
    # Sections post-fondamental : [{orientation, name, classes|years}, ...].
    post_fondamental_sections = models.JSONField(default=list, blank=True)

    # --- Référencement ---
    accreditation_number = models.CharField(max_length=100, blank=True, default='')
    accreditation_body = models.CharField(max_length=200, blank=True, default='')
    accreditation_valid_until = models.DateField(null=True, blank=True)

    # Messages école envoyés à l'élève. Vides = texte par défaut du module.
    enrollment_received_message = models.TextField(blank=True, default='')
    enrollment_refusal_message = models.TextField(blank=True, default='')
    enrollment_accepted_message = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Fiche établissement Éducation'
        ordering = ['business__name']
        indexes = [
            models.Index(fields=['publication_status'], name='idx_eduprofile_pubstatus'),
            models.Index(fields=['business', 'publication_status'], name='idx_eduprofile_biz_status'),
        ]

    def __str__(self):
        return self.business.name

    @property
    def is_public(self):
        return self.publication_status == PublicationStatus.PUBLISHED

    def mark_published(self):
        self.publication_status = PublicationStatus.PUBLISHED
        self.published_at = self.published_at or timezone.now()
        self.save(update_fields=['publication_status', 'published_at', 'updated_at'])


class EducationUnit(models.Model):
    """Faculté ou département. Optionnel : une école publie ses formations
    directement sous l'établissement."""

    UNIT_KIND_CHOICES = (
        ('FACULTY', 'Faculté'),
        ('DEPARTMENT', 'Département'),
        ('SCHOOL', 'École interne'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        'businesses.Business',
        on_delete=models.CASCADE,
        related_name='education_units',
    )
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children',
    )
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16, choices=UNIT_KIND_CHOICES, default='DEPARTMENT')
    code = models.CharField(max_length=50, blank=True, default='')
    description = models.TextField(blank=True, default='')
    tuition = models.JSONField(
        default=dict, blank=True,
        verbose_name='Frais de scolarité',
        help_text='Barème de la faculté, pour les programmes qui n’ont pas le leur. Peut varier par niveau.',
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Faculté / département'
        ordering = ['name']
        indexes = [
            models.Index(fields=['business', 'is_active'], name='idx_eduunit_biz_active'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['business', 'name'], name='uniq_education_unit_per_business',
            ),
        ]

    def __str__(self):
        return self.name


class EducationProgram(models.Model):
    """Formation proposée par l'établissement."""

    LEVEL_CHOICES = (
        ('PRIMARY', 'Primaire'),
        ('LOWER_SECONDARY', 'Collège'),
        ('UPPER_SECONDARY', 'Lycée'),
        ('VOCATIONAL', 'Technique / professionnel'),
        ('LICENCE', 'Licence'),
        ('MASTER', 'Master'),
        ('DOCTORATE', 'Doctorat'),
        ('CERTIFICATE', 'Certificat / diplôme court'),
        ('OTHER', 'Autre'),
    )

    DEGREE_TYPE_CHOICES = (
        ('BACHELOR', 'Bachelor / Licence'),
        ('MASTER', 'Master'),
        ('DOCTORATE', 'Doctorat / PhD'),
        ('PROFESSIONAL_BACHELOR', 'Licence professionnelle'),
        ('PROFESSIONAL_MASTER', 'Master professionnel'),
        ('ENGINEERING', 'Diplôme d\'ingénieur'),
        ('MEDICAL', 'Diplôme médical / pharmaceutique'),
        ('DUT', 'DUT / BTS'),
        ('CERTIFICATE', 'Certificat'),
        ('OTHER', 'Autre'),
    )

    ADMISSION_SELECTIVITY_CHOICES = (
        ('OPEN', 'Ouvert (sur dossier)'),
        ('SELECTIVE', 'Sélectif (concours / notes)'),
        ('VERY_SELECTIVE', 'Très sélectif (concours national)'),
        ('RESTRICTED', 'Accès restreint (quotas)'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        'businesses.Business',
        on_delete=models.CASCADE,
        related_name='education_programs',
    )
    unit = models.ForeignKey(
        EducationUnit, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='programs',
    )

    title = models.CharField(max_length=250, verbose_name='Intitulé')
    domain = models.CharField(max_length=150, blank=True, default='', verbose_name='Domaine')
    degree_awarded = models.CharField(
        max_length=200, blank=True, default='', verbose_name='Diplôme délivré',
    )
    duration_years = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True, verbose_name='Durée (années)',
    )
    duration_label = models.CharField(max_length=100, blank=True, default='')
    entry_level = models.CharField(max_length=120, blank=True, default='', verbose_name='Niveau d’entrée')
    exit_level = models.CharField(max_length=120, blank=True, default='', verbose_name='Niveau de sortie')
    career_outlook = models.TextField(
        blank=True, default='', verbose_name='Débouchés',
    )

    # --- Contenu pédagogique (doc §4.2) ---
    semester_organization = models.CharField(
        max_length=150, blank=True, default='',
        verbose_name='Organisation en semestres', help_text='Ex: 6 semestres, 2 ans.',
    )
    main_subjects = models.TextField(
        blank=True, default='', verbose_name='Matières principales',
    )
    admission_conditions = models.TextField(
        blank=True, default='', verbose_name='Conditions d’admission',
    )
    # Liste de libellés : {label, description} pour garder le détail.
    required_documents = models.JSONField(
        default=list, blank=True, verbose_name='Pièces requises',
    )
    internship_details = models.TextField(
        blank=True, default='', verbose_name='Modalités de stage',
    )
    options = models.JSONField(
        default=list, blank=True,
        verbose_name='Options',
        help_text='Université : options d\'un baccalauréat ou d\'un master, une par ligne.',
    )
    study_year_labels = models.JSONField(
        default=list, blank=True,
        verbose_name='Niveaux d\'inscription',
        help_text='Libellés des années du cycle. Vide : proposés selon le cycle et la durée.',
    )
    tuition = models.JSONField(
        default=dict, blank=True,
        verbose_name='Frais de scolarité',
        help_text='Barème du programme. S’il est renseigné, il remplace celui de la faculté. Peut varier par option et par niveau.',
    )

    degree_type = models.CharField(
        max_length=32, choices=DEGREE_TYPE_CHOICES, blank=True, default='',
        verbose_name='Type de diplôme',
    )
    credits = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='Crédits (ECTS ou locaux)',
        help_text='Total crédits du cycle (ex: 180 pour Licence, 120 pour Master).',
    )
    admission_selectivity = models.CharField(
        max_length=32, choices=ADMISSION_SELECTIVITY_CHOICES, blank=True, default='',
        verbose_name='Sélectivité admission',
    )
    language_of_instruction = models.CharField(
        max_length=100, blank=True, default='',
        verbose_name='Langue(s) d\'enseignement',
        help_text='Ex: Français, Anglais, Kirundi. Séparées par des virgules.',
    )

    level = models.CharField(max_length=32, choices=LEVEL_CHOICES, default='OTHER')
    is_active = models.BooleanField(default=True, help_text='Formation encore ouverte.')
    is_public = models.BooleanField(
        default=False, help_text='Visible sur la fiche publique de l’établissement.',
    )
    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Formation'
        verbose_name_plural = 'Formations'
        ordering = ['display_order', 'title']
        indexes = [
            models.Index(fields=['business', 'is_public'], name='idx_eduprog_biz_public'),
            models.Index(fields=['business', 'level'], name='idx_eduprog_biz_level'),
        ]

    def __str__(self):
        return self.title


class AdmissionCampaign(models.Model):
    """Calendrier et conditions d'une formation pour une année."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        'businesses.Business', on_delete=models.CASCADE, related_name='education_campaigns',
    )
    program = models.ForeignKey(
        EducationProgram, on_delete=models.CASCADE, related_name='campaigns',
        null=True, blank=True,
    )
    academic_year = models.CharField(max_length=20)
    opens_on = models.DateField()
    closes_on = models.DateField()
    late_opens_on = models.DateField(null=True, blank=True)
    late_closes_on = models.DateField(null=True, blank=True)
    contest_date = models.DateField(null=True, blank=True)
    contest_name = models.CharField(
        max_length=200, blank=True, default='',
        verbose_name='Concours ou test d’admission',
    )
    results_date = models.DateField(null=True, blank=True)
    confirmation_start = models.DateField(null=True, blank=True)
    confirmation_end = models.DateField(null=True, blank=True)
    required_diploma = models.CharField(max_length=200, blank=True, default='')
    prerequisites = models.TextField(blank=True, default='')
    min_grade = models.CharField(max_length=40, blank=True, default='')
    extra_conditions = models.TextField(blank=True, default='')
    regulatory_requirements = models.TextField(
        blank=True, default='', verbose_name='Exigences réglementaires',
    )
    required_documents = models.JSONField(
        default=list, blank=True, verbose_name='Pièces de l’année',
        help_text='Université : pièces de la formation. École : pièces communes aux inscriptions anciennes.',
    )
    # Sous-ensemble des parcours de l'école ouverts pour cette année scolaire.
    open_tracks = models.JSONField(
        default=list, blank=True,
        verbose_name='Parcours ouverts',
        help_text='PRESCOLAIRE, ECOFO, POST_FONDAMENTAL — uniquement pour les campagnes école.',
    )
    # Plan détaillé : [{track, year, section, seats}, ...] — fixé à l'ouverture.
    enrollment_plan = models.JSONField(
        default=list, blank=True,
        verbose_name='Plan d’inscription',
        help_text='Années ouvertes, places, et documents demandés pour chaque classe.',
    )
    extra_criteria = models.JSONField(
        default=list, blank=True,
        verbose_name='Critères supplémentaires',
        help_text='Ex. test de sélection, entretien. Chaque ligne : kind, label, date, place, details.',
    )
    is_public = models.BooleanField(default=True)
    fee_mode = models.CharField(
        max_length=16, blank=True, default='',
        choices=(('PAYANT', 'Payante'), ('GRATUIT', 'Gratuite')),
        help_text='Une inscription payante et une gratuite peuvent coexister pour la même année (école) ou le même programme (université).',
    )
    year_start = models.DateField(null=True, blank=True, verbose_name='Rentrée')
    year_break_start = models.DateField(null=True, blank=True, verbose_name='Début de pause')
    year_break_end = models.DateField(null=True, blank=True, verbose_name='Fin de pause')
    year_exam_start = models.DateField(null=True, blank=True, verbose_name='Début des examens')
    year_deliberation = models.DateField(null=True, blank=True, verbose_name='Délibération')

    class Meta:
        ordering = ['-opens_on']
        indexes = [
            models.Index(fields=['business', 'is_public'], name='idx_educamp_biz_public'),
            models.Index(fields=['business', 'academic_year'], name='idx_educamp_biz_year'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['program', 'academic_year', 'fee_mode'],
                condition=models.Q(program__isnull=False) & ~models.Q(fee_mode=''),
                name='uniq_education_program_year_mode',
            ),
            models.UniqueConstraint(
                fields=['business', 'academic_year', 'fee_mode'],
                condition=models.Q(program__isnull=True) & ~models.Q(fee_mode=''),
                name='uniq_education_school_year_mode',
            ),
            models.CheckConstraint(
                condition=models.Q(opens_on__lte=models.F('closes_on')),
                name='education_campaign_opens_before_close',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(late_opens_on__isnull=True)
                    | models.Q(late_closes_on__isnull=True)
                    | models.Q(late_opens_on__lte=models.F('late_closes_on'))
                ),
                name='education_campaign_late_window_ordered',
            ),
        ]

    def is_open_on(self, day):
        if self.opens_on <= day <= self.closes_on:
            return True
        if self.late_opens_on and self.late_closes_on and self.late_opens_on <= day <= self.late_closes_on:
            return True
        return False


def new_dossier_token():
    return secrets.token_urlsafe(32)


class EnrollmentApplication(models.Model):
    STATUS = (
        ('BROUILLON', 'Brouillon'),
        ('ENVOYEE', 'Envoyée'),
        ('EN_INSTRUCTION', 'En instruction'),
        ('COMPLEMENT_DEMANDE', 'Complément demandé'),
        ('LISTE_ATTENTE', 'Liste d’attente'),
        ('ACCEPTEE', 'Acceptée'),
        ('REFUSEE', 'Refusée'),
        ('CONFIRMEE', 'Confirmée'),
    )
    FINAL = {'ACCEPTEE', 'REFUSEE', 'CONFIRMEE'}

    TRACK_PRESCOLAIRE = 'PRESCOLAIRE'
    TRACK_ECOFO = 'ECOFO'
    TRACK_POST = 'POST_FONDAMENTAL'
    TRACK_CHOICES = (
        (TRACK_PRESCOLAIRE, 'Maternelle / Préscolaire'),
        (TRACK_ECOFO, 'École fondamentale (ECOFO)'),
        (TRACK_POST, 'Post-fondamental'),
    )
    ECOFO_YEAR_CHOICES = (
        ('1', '1ère année'),
        ('2', '2ème année'),
        ('3', '3ème année'),
        ('4', '4ème année'),
        ('5', '5ème année'),
        ('6', '6ème année'),
        ('7', '7ème année'),
        ('8', '8ème année'),
        ('9', '9ème année'),
        ('OTHER', 'Autre année'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        'businesses.Business', on_delete=models.CASCADE, related_name='education_applications',
    )
    campaign = models.ForeignKey(
        AdmissionCampaign, on_delete=models.PROTECT, related_name='applications',
    )
    applicant = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='education_applications',
        null=True, blank=True,
    )
    # Coordonnées candidature (formulaire public, comme un RDV).
    student_name = models.CharField(max_length=200, blank=True, default='')
    student_email = models.EmailField(blank=True, default='')
    student_phone = models.CharField(max_length=500, blank=True, default='')
    birth_date = models.DateField(null=True, blank=True, verbose_name='Date de naissance')
    GENDER = (
        ('F', 'Féminin'),
        ('M', 'Masculin'),
    )
    gender = models.CharField(max_length=1, choices=GENDER, blank=True, default='')
    previous_school = models.CharField(max_length=500, blank=True, default='', verbose_name='École précédente')
    student_address = models.CharField(max_length=800, blank=True, default='', verbose_name='Adresse')
    guardian_name = models.CharField(max_length=500, blank=True, default='', verbose_name='Parent ou tuteur')
    guardian_phone = models.CharField(max_length=500, blank=True, default='')
    guardian_link = models.CharField(
        max_length=40, blank=True, default='',
        verbose_name='Lien avec l’élève',
        help_text='Mère, père, tuteur…',
    )
    # Parcours école : vide pour les demandes universitaires (formation sur la campagne).
    track = models.CharField(max_length=32, choices=TRACK_CHOICES, blank=True, default='')
    ecofo_year = models.CharField(
        max_length=16, blank=True, default='',
        verbose_name='Année ECOFO',
    )
    post_section = models.CharField(
        max_length=120, blank=True, default='',
        verbose_name='Section post-fondamental',
    )
    post_year = models.CharField(
        max_length=16, blank=True, default='',
        verbose_name='Année post-fondamental',
    )
    # Copie figée des pièces au moment de la création (catalogue + extras école).
    required_documents = models.JSONField(default=list, blank=True)
    profile_details = models.JSONField(
        default=dict, blank=True,
        verbose_name='Détail du candidat',
        help_text='Université : identité, études antérieures, contact et niveau (BAC I, II, III).',
    )
    criteria_acknowledged = models.BooleanField(
        default=False,
        verbose_name='Critères supplémentaires acceptés',
    )
    access_token = models.CharField(max_length=64, unique=True, default=new_dossier_token, editable=False)
    status = models.CharField(max_length=24, choices=STATUS, default='BROUILLON')
    decision_note = models.TextField(blank=True, default='')
    document = models.FileField(upload_to='education/applications/%Y/%m/', blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['business', 'status'], name='idx_eduapp_biz_status'),
            models.Index(fields=['campaign', 'status'], name='idx_eduapp_camp_status'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'applicant'],
                condition=models.Q(applicant__isnull=False),
                name='uniq_education_application_per_campaign',
            ),
            models.UniqueConstraint(
                fields=['campaign', 'student_email'],
                condition=~models.Q(student_email=''),
                name='uniq_education_application_per_email',
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=[
                    'BROUILLON', 'ENVOYEE', 'EN_INSTRUCTION', 'COMPLEMENT_DEMANDE',
                    'LISTE_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'CONFIRMEE',
                ]),
                name='education_application_status_known',
            ),
        ]

    def save(self, *args, **kwargs):
        from .tenant_crypto import close_application, open_application
        close_application(self, kwargs.get('update_fields'))
        try:
            super().save(*args, **kwargs)
        finally:
            open_application(self)

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        from .tenant_crypto import open_application
        open_application(instance)
        return instance


class EnrollmentDocument(models.Model):
    """Une pièce du dossier, correspondant à un libellé publié sur la campagne."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        EnrollmentApplication, on_delete=models.CASCADE, related_name='files',
    )
    label = models.CharField(max_length=200)
    file = models.FileField(upload_to='education/applications/%Y/%m/')
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['application', 'label'], name='uniq_education_document_label',
            ),
        ]


class EnrollmentEvent(models.Model):
    application = models.ForeignKey(
        EnrollmentApplication, on_delete=models.CASCADE, related_name='events',
    )
    actor = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True,
    )
    from_status = models.CharField(max_length=24, blank=True, default='')
    to_status = models.CharField(max_length=24)
    note = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)


class EducationFee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        'businesses.Business', on_delete=models.CASCADE, related_name='education_fees',
    )
    program = models.ForeignKey(
        EducationProgram, on_delete=models.CASCADE, null=True, blank=True, related_name='fees',
    )
    academic_year = models.CharField(max_length=20, blank=True, default='')
    campaign = models.ForeignKey(
        'AdmissionCampaign', on_delete=models.CASCADE, null=True, blank=True,
        related_name='enrollment_fees',
    )
    label = models.CharField(max_length=200)
    amount_bif = models.PositiveIntegerField()
    is_required = models.BooleanField(default=True)
    due_date = models.DateField(null=True, blank=True)
    is_public = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount_bif__gte=0),
                name='education_fee_amount_non_negative',
            ),
        ]


class EducationFeePayment(models.Model):
    STATUS = (
        ('UNPAID', 'Non payé'),
        ('AWAITING_PIN', 'En attente PIN'),
        ('PAID', 'Payé'),
        ('FAILED', 'Échoué'),
        ('WAIVED', 'Exonéré'),
        ('BORDEREAU_RECU', 'Bordereau reçu'),
    )
    METHOD = (
        ('BURUNDIPAY', 'BurundiPay'),
        ('BORDEREAU', 'Bordereau'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fee = models.ForeignKey(EducationFee, on_delete=models.PROTECT, related_name='payments')
    application = models.ForeignKey(
        'EnrollmentApplication', on_delete=models.CASCADE, null=True, blank=True,
        related_name='fee_payments',
    )
    applicant = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, null=True, blank=True,
        related_name='education_fee_payments',
    )
    status = models.CharField(max_length=20, choices=STATUS, default='UNPAID')
    method = models.CharField(max_length=16, choices=METHOD, blank=True, default='')
    bordereau = models.FileField(upload_to='education/bordereaux/%Y/%m/', blank=True, null=True)
    payer_phone = models.CharField(max_length=500, blank=True, default='')
    provider_reference = models.CharField(max_length=120, blank=True, default='')
    # Compte marchand utilisé au moment du debit. Fige comme dans les autres
    # modules de paiement : changer le compte de l'etablissement ne doit pas
    # reecrire l'historique de ce qui a ete encaisse.
    merchant_account = models.CharField(
        max_length=120, blank=True, default='',
        help_text='Compte marchand BurundiPay ayant encaisse ce frais.',
    )
    payment_token = models.CharField(max_length=64, default='', blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['UNPAID', 'AWAITING_PIN', 'PAID', 'FAILED', 'WAIVED', 'BORDEREAU_RECU']),
                name='education_fee_payment_status_known',
            ),
            models.UniqueConstraint(
                fields=['fee', 'application'],
                condition=models.Q(application__isnull=False),
                name='uniq_education_fee_payment_per_application',
            ),
        ]

    def save(self, *args, **kwargs):
        from .tenant_crypto import close_payment, open_payment
        close_payment(self, kwargs.get('update_fields'))
        try:
            super().save(*args, **kwargs)
        finally:
            open_payment(self)

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        from .tenant_crypto import open_payment
        open_payment(instance)
        return instance


class SchoolPlanSeat(models.Model):
    """Place d'une classe, copie typée du plan JSON d'une année scolaire."""

    campaign = models.ForeignKey(
        AdmissionCampaign, on_delete=models.CASCADE, related_name='plan_seats',
    )
    track = models.CharField(max_length=32)
    year = models.CharField(max_length=16, blank=True, default='')
    section = models.CharField(max_length=80, blank=True, default='')
    seats = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'track', 'year', 'section'],
                name='uniq_school_plan_seat',
            ),
            models.CheckConstraint(
                condition=models.Q(seats__gte=0),
                name='school_plan_seat_non_negative',
            ),
        ]


class SchoolCriterion(models.Model):
    """Critère supplémentaire (test, entretien), copie typée du JSON."""

    campaign = models.ForeignKey(
        AdmissionCampaign, on_delete=models.CASCADE, related_name='criteria_rows',
    )
    position = models.PositiveIntegerField(default=0)
    kind = models.CharField(max_length=32, blank=True, default='')
    label = models.CharField(max_length=200, blank=True, default='')
    date = models.CharField(max_length=40, blank=True, default='')
    place = models.CharField(max_length=200, blank=True, default='')
    details = models.TextField(blank=True, default='')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'position'],
                name='uniq_school_criterion_position',
            ),
        ]
