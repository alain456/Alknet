import uuid
from django.db import models
from django.conf import settings
from business_categories.models import BusinessCategory
from django.utils import timezone

class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='businesses')
    primary_category = models.ForeignKey(BusinessCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='primary_businesses')
    category = models.ForeignKey(BusinessCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='legacy_businesses')
    categories = models.ManyToManyField(BusinessCategory, related_name='businesses', blank=True)
    
    name = models.CharField(max_length=255)
    slug = models.SlugField(
        max_length=80, unique=True, null=True, blank=True,
        help_text='Sous-domaine public, par exemple biu.isokohub.com.',
    )
    custom_domain = models.CharField(
        max_length=255, blank=True, default='', db_index=True,
        help_text='Domaine propre du client, par exemple boutique.client.bi.',
    )
    logo = models.TextField(blank=True, help_text="URL ou Image Base64 du logo")
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    province = models.CharField(max_length=100, default='Bujumbura Mairie', help_text="Province du siège")
    commune = models.CharField(max_length=100, blank=True, help_text="Commune (ex: Mukaza, Ntahangwa, Muha...)")
    zone = models.CharField(max_length=100, blank=True, help_text="Zone administrative")
    quartier = models.CharField(max_length=100, blank=True, help_text="Quartier/Colline (ex: Rohero I, Bwiza, Ngagara...)")
    avenue = models.CharField(max_length=150, blank=True, help_text="Avenue/Rue (Optionnel)")
    latitude = models.FloatField(null=True, blank=True, help_text="Coordonnée GPS Latitude")
    longitude = models.FloatField(null=True, blank=True, help_text="Coordonnée GPS Longitude")
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    burundipay_merchant_account = models.CharField(
        max_length=80,
        blank=True,
        help_text="Compte marchand BurundiPay de l'établissement (encaissement consultations / commandes)",
    )
    
    VERIFICATION_STATUS_CHOICES = (
        ('APPROVED', 'Approuvé'),
        ('PENDING', 'En attente de validation'),
        ('REJECTED', 'Rejeté'),
    )

    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS_CHOICES, default='APPROVED')
    proof_document = models.CharField(max_length=555, blank=True, help_text="URL du justificatif / Agrément ministériel")
    rejection_reason = models.TextField(blank=True, help_text="Motif du rejet par la modération")
    extra_attributes = models.JSONField(default=dict, blank=True, help_text="Spécificités métiers par secteur (ex: agrément, étoiles, piscine, cuisine...)")

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Businesses"

    @property
    def full_address(self):
        components = []
        if self.address and self.address.strip():
            components.append(self.address.strip())
        
        for part in [self.avenue, self.quartier, self.zone, self.commune, self.province]:
            if part and part.strip():
                p_clean = part.strip()
                if not any(p_clean.lower() in c.lower() for c in components):
                    components.append(p_clean)
        
        return ", ".join(components) if components else "Adresse non renseignée"

    def save(self, *args, **kwargs):
        if not (self.slug or '').strip():
            from .slug import allocate_business_slug
            self.slug = allocate_business_slug(self.name, exclude_pk=self.pk)
            update_fields = kwargs.get('update_fields')
            if update_fields is not None:
                kwargs['update_fields'] = list(set(update_fields) | {'slug'})
        if not self.address:
            hierarchical_parts = [p for p in [self.avenue, self.quartier, self.zone, self.commune, self.province] if p]
            if hierarchical_parts:
                self.address = ", ".join(hierarchical_parts)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class BusinessRole(models.Model):
    """Rôle dynamique créé par un hôpital/entreprise, lié à un niveau de sécurité strict."""
    SYSTEM_ACCESS_CHOICES = (
        ('OWNER_ACCESS', 'Accès Propriétaire'),
        ('ADMIN_ACCESS', 'Accès Administrateur'),
        ('MEDICAL_ACCESS', 'Accès Médical (Médecins, Spécialistes)'),
        ('RECEPTIONIST_ACCESS', 'Accès Accueil & Réception'),
        ('LAB_ACCESS', 'Accès Laboratoire'),
        ('CASHIER_ACCESS', 'Accès Caisse & Facturation'),
        ('STAFF_ACCESS', 'Accès Staff Standard'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='roles')
    name = models.CharField(max_length=150, help_text="Nom personnalisé du rôle (ex: Infirmier de Nuit)")
    system_access_level = models.CharField(max_length=50, choices=SYSTEM_ACCESS_CHOICES, default='STAFF_ACCESS')
    permissions = models.JSONField(default=list, blank=True, help_text="Liste des clés de permissions accordées au rôle")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('business', 'name')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_system_access_level_display()})"

class BusinessEmployee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='employments')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='employees')
    role = models.ForeignKey(BusinessRole, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    position = models.CharField(max_length=100, default='Staff', blank=True)
    is_active = models.BooleanField(default=True)
    education_scope_unit = models.UUIDField(
        null=True, blank=True,
        help_text='Université : faculté dont cet employé voit les programmes et les dossiers. Vide : tout l’établissement.',
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('user', 'business')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.business.name} ({self.position})"


class SubscriptionPlan(models.Model):
    """Plans d'abonnement Isoko Hub (SaaS) — payés par l'entreprise à la plateforme."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price_bif = models.PositiveIntegerField(default=0, help_text="Prix en BIF (0 = gratuit / essai)")
    duration_days = models.PositiveIntegerField(default=30)
    max_employees = models.PositiveIntegerField(
        default=0,
        help_text="Nombre max d'employés. 0 = illimité.",
    )
    is_trial = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['price_bif', 'name']

    def __str__(self):
        return f"{self.name} ({self.price_bif} BIF / {self.duration_days}j)"


class BusinessSubscription(models.Model):
    """
    Abonnement d'une entreprise à Isoko Hub.
    Distinct des paiements client↔vendeur (commandes) et patient↔hôpital (RDV).
    """
    STATUS_CHOICES = (
        ('TRIAL', 'Free'),
        ('ACTIVE', 'Actif'),
        ('GRACE', 'Période de grâce'),
        ('EXPIRED', 'Expiré'),
        ('SUSPENDED', 'Suspendu'),
        ('CANCELLED', 'Annulé'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        Business, on_delete=models.CASCADE, related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.PROTECT, related_name='subscriptions'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='TRIAL')
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField()
    payment_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    expiry_warning_ends_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Échéance pour laquelle l'alerte des 5 jours a déjà été envoyée",
    )
    grace_notice_ends_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Échéance pour laquelle le début de grâce a déjà été signalé",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-ends_at']
        verbose_name = "Abonnement entreprise"
        verbose_name_plural = "Abonnements entreprises"

    def __str__(self):
        return f"{self.business.name} — {self.status} jusqu'au {self.ends_at.date()}"

    @property
    def is_currently_active(self):
        from .subscription import subscription_still_usable
        return subscription_still_usable(self)

    def refresh_status(self, save=True):
        """Met à jour actif / grâce / expiré et envoie les alertes d'échéance."""
        from .subscription import apply_subscription_lifecycle
        return apply_subscription_lifecycle(self, save=save)


class PlatformSubscriptionSettings(models.Model):
    """Réglage unique : période de grâce SaaS appliquée à toutes les entreprises."""
    grace_period_days = models.PositiveIntegerField(
        default=7,
        help_text="Jours d'accès après l'échéance, pour toutes les entreprises",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Réglage abonnement plateforme"
        verbose_name_plural = "Réglages abonnement plateforme"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Période de grâce : {self.grace_period_days} j"


class SubscriptionPayment(models.Model):
    """
    Paiement d'abonnement SaaS : Entreprise → compte marchand Isoko Hub (BurundiPay).
    Distinct des paiements privés client↔vendeur sur les commandes.
    """
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('AWAITING_PIN', 'En attente validation PIN'),
        ('SUCCESS', 'Réussi'),
        ('FAILED', 'Échoué'),
        ('CANCELLED', 'Annulé'),
        ('EXPIRED', 'Expiré'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='subscription_payments'
    )
    subscription = models.ForeignKey(
        BusinessSubscription, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments',
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.PROTECT, related_name='payments'
    )
    amount_bif = models.PositiveIntegerField()
    currency = models.CharField(max_length=10, default='BIF')
    payer_phone = models.CharField(max_length=40, help_text='Numéro BurundiPay du payeur (entreprise)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    provider = models.CharField(max_length=40, default='BURUNDIPAY')
    provider_reference = models.CharField(max_length=120, blank=True, db_index=True)
    merchant_account = models.CharField(
        max_length=80, blank=True,
        help_text='Compte marchand plateforme Isoko Hub',
    )
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='subscription_payments_initiated',
    )
    raw_request = models.JSONField(default=dict, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    invoice_number = models.CharField(max_length=40, blank=True, default='', db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Paiement abonnement SaaS'
        verbose_name_plural = 'Paiements abonnements SaaS'

    def __str__(self):
        return f"{self.business.name} — {self.amount_bif} BIF ({self.status})"


class PlatformNotification(models.Model):
    """
    Notifications Super Admin plateforme (ex: paiement abonnement SaaS reçu).
    Visible dans /admin/payments et le tableau de bord.
    """
    TYPE_CHOICES = (
        ('SUBSCRIPTION_PAID', 'Abonnement payé'),
        ('SUBSCRIPTION_FAILED', 'Échec paiement abo'),
        ('SUBSCRIPTION_EXPIRING', 'Abonnement bientôt expiré'),
        ('SUBSCRIPTION_GRACE', 'Période de grâce'),
        ('INFO', 'Information'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification_type = models.CharField(max_length=40, choices=TYPE_CHOICES, default='INFO')
    title = models.CharField(max_length=255)
    message = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    business = models.ForeignKey(
        Business, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='platform_notifications',
    )
    payment = models.ForeignKey(
        'SubscriptionPayment', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='platform_notifications',
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification plateforme'
        verbose_name_plural = 'Notifications plateforme'

    def __str__(self):
        return f"{self.title} ({'lu' if self.is_read else 'non lu'})"


class StockAlert(models.Model):
    """Alerte envoyée à l'administrateur quand un article passe en stock faible ou en rupture."""
    LEVEL_CHOICES = (
        ('LOW', 'Stock faible'),
        ('OUT', 'Rupture'),
        ('EXPIRING', 'Péremption proche'),
        ('EXPIRED', 'Périmé'),
    )
    SECTOR_CHOICES = (
        ('commerce', 'Commerce'),
        ('retail', 'Pharmacie de détail'),
        ('wholesale', 'Pharmacie de gros'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='stock_alerts')
    sector = models.CharField(max_length=20, choices=SECTOR_CHOICES)
    product_id = models.UUIDField()
    variant_id = models.UUIDField(null=True, blank=True)
    product_name = models.CharField(max_length=255)
    level = models.CharField(max_length=8, choices=LEVEL_CHOICES)
    quantity = models.IntegerField(default=0)
    threshold = models.PositiveIntegerField(default=0)
    is_read = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Alerte de stock'
        verbose_name_plural = 'Alertes de stock'

    def __str__(self):
        return f'{self.product_name} ({self.level})'


class InventorySession(models.Model):
    """Séance de comptage. Le stock théorique est recopié à l'ouverture."""
    STATUS_CHOICES = (
        ('OPEN', 'En cours'),
        ('VALIDATED', 'Validé'),
        ('CANCELLED', 'Abandonné'),
    )
    SECTOR_CHOICES = (
        ('commerce', 'Commerce'),
        ('retail', 'Pharmacie de détail'),
        ('wholesale', 'Pharmacie de gros'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='inventory_sessions')
    sector = models.CharField(max_length=20, choices=SECTOR_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='inventory_sessions_opened',
    )
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='inventory_sessions_validated',
    )
    opened_at = models.DateTimeField(default=timezone.now)
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-opened_at']
        verbose_name = 'Inventaire'
        verbose_name_plural = 'Inventaires'

    def __str__(self):
        return f'Inventaire {self.business.name} ({self.status})'


class InventoryLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(InventorySession, on_delete=models.CASCADE, related_name='lines')
    product_id = models.UUIDField()
    variant_id = models.UUIDField(null=True, blank=True)
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=80, blank=True, default='')
    batch_number = models.CharField(max_length=120, blank=True, default='')
    expiration_date = models.DateField(null=True, blank=True)
    theoretical_qty = models.PositiveIntegerField()
    counted_qty = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['product_name']
        constraints = [
            models.UniqueConstraint(
                fields=['session', 'product_id'],
                condition=models.Q(variant_id__isnull=True),
                name='uniq_inventory_line_product',
            ),
            models.UniqueConstraint(
                fields=['session', 'variant_id'],
                condition=models.Q(variant_id__isnull=False),
                name='uniq_inventory_line_variant',
            ),
        ]

    def __str__(self):
        return self.product_name


class CommerceProfile(models.Model):
    """Profil vertical Commerce (Boutique, Mode, Quincaillerie, Supermarché, …)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        Business, on_delete=models.CASCADE, related_name='commerce_profile',
    )
    commercial_name = models.CharField(max_length=255, blank=True, default='')
    order_reference_prefix = models.CharField(max_length=20, default='CMD')
    pickup_instructions = models.TextField(
        blank=True,
        default='Retrait en magasin après confirmation de paiement.',
    )
    order_received_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {client_name},\n\n'
            'Votre commande {reference} a bien été enregistrée chez {shop_name}.\n'
            'Montant : {total_amount} {currency}.\n\n'
            'Vous recevrez un e-mail dès que la boutique aura accepté ou refusé votre commande.\n\n'
            'Cordialement,\n{shop_name}'
        ),
    )
    order_accepted_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {client_name},\n\n'
            'Votre commande {reference} a été acceptée par {shop_name}.\n'
            'Montant : {total_amount} {currency}.\n'
            'Retrait en magasin.\n\n'
            'Cordialement,\n{shop_name}'
        ),
    )
    order_refused_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {client_name},\n\n'
            'Votre commande {reference} a été refusée par {shop_name}.\n\n'
            'Cordialement,\n{shop_name}'
        ),
    )
    is_open_for_orders = models.BooleanField(default=True)

    # Justificatifs Burundi (inscription)
    nif_number = models.CharField(
        max_length=64, blank=True, default='', db_index=True,
        help_text='NIF — Numéro d\'Identification Fiscale (OBR)',
    )
    rccm_number = models.CharField(
        max_length=64, blank=True, default='', db_index=True,
        help_text='RCCM — Registre du Commerce et du Crédit Mobilier',
    )
    permit_number = models.CharField(
        max_length=64, blank=True, default='', db_index=True,
        help_text='Patente / autorisation d\'exercer / attestation communale',
    )
    nif_document = models.TextField(blank=True, default='', help_text='Scan NIF (data URL)')
    rccm_document = models.TextField(blank=True, default='', help_text='Scan RCCM (data URL)')
    permit_document = models.TextField(blank=True, default='', help_text='Scan patente / autorisation')
    nif_document_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    rccm_document_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    permit_document_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['nif_number'],
                condition=~models.Q(nif_number=''),
                name='uniq_commerce_nif_number',
            ),
            models.UniqueConstraint(
                fields=['rccm_number'],
                condition=~models.Q(rccm_number=''),
                name='uniq_commerce_rccm_number',
            ),
            models.UniqueConstraint(
                fields=['permit_number'],
                condition=~models.Q(permit_number=''),
                name='uniq_commerce_permit_number',
            ),
            models.UniqueConstraint(
                fields=['nif_document_hash'],
                condition=~models.Q(nif_document_hash=''),
                name='uniq_commerce_nif_doc_hash',
            ),
            models.UniqueConstraint(
                fields=['rccm_document_hash'],
                condition=~models.Q(rccm_document_hash=''),
                name='uniq_commerce_rccm_doc_hash',
            ),
            models.UniqueConstraint(
                fields=['permit_document_hash'],
                condition=~models.Q(permit_document_hash=''),
                name='uniq_commerce_permit_doc_hash',
            ),
        ]

    def __str__(self):
        return self.commercial_name or self.business.name


class BurundiPayReceipt(models.Model):
    """Une référence prestataire ne peut confirmer qu'un seul paiement."""
    provider_reference = models.CharField(max_length=120, unique=True)
    external_id = models.CharField(max_length=160, blank=True, default='')
    status = models.CharField(max_length=40, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)


class EmployeeInvitation(models.Model):
    """Preuve de possession avant de rattacher un compte déjà existant."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='employee_invitations')
    email = models.EmailField()
    token = models.CharField(max_length=64, unique=True)
    position = models.CharField(max_length=100, blank=True, default='STAFF')
    role = models.ForeignKey(
        'BusinessRole', on_delete=models.SET_NULL, null=True, blank=True, related_name='invitations',
    )
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
