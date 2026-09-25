import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from businesses.models import Business


class HotelProfile(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Actif'),
        ('SUSPENDED', 'Suspendu'),
        ('CLOSED', 'Fermé'),
    )
    ESTABLISHMENT_TYPES = (
        ('HOTEL', 'Hôtel'),
        ('GUEST_HOUSE', 'Guest house'),
        ('LODGE', 'Lodge'),
        ('RESIDENCE', 'Résidence'),
        ('HOSTEL', 'Auberge'),
        ('OTHER', 'Autre hébergement'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(Business, on_delete=models.CASCADE, related_name='hotel_profile')
    trade_name = models.CharField(max_length=255, blank=True, default='')
    establishment_type = models.CharField(max_length=30, choices=ESTABLISHMENT_TYPES, default='HOTEL')
    # Classification : déclarée par l'hôtel vs vérifiée par l'admin plateforme (HOTELLERIE 2)
    stars = models.PositiveSmallIntegerField(null=True, blank=True, help_text='Étoiles déclarées')
    stars_verified = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text='Étoiles vérifiées par la plateforme',
    )
    classification_verified = models.BooleanField(default=False)
    license_number = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    check_in_time = models.TimeField(default='14:00')
    check_out_time = models.TimeField(default='12:00')
    customer_service_hours = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Ex. Lun–Dim 07:00–22:00',
    )
    languages = models.JSONField(default=list, blank=True, help_text='Ex. ["fr","en","rn"]')
    currency = models.CharField(max_length=10, default='BIF')
    amenities = models.JSONField(default=list, blank=True)
    cancellation_policy = models.TextField(blank=True, default='')
    stay_conditions = models.TextField(
        blank=True, default='',
        help_text='Règles propres à l\'établissement (visiteurs, âge, documents…)',
    )
    pets_allowed = models.BooleanField(default=False)
    smoking_allowed = models.BooleanField(default=False)
    deposit_policy = models.TextField(blank=True, default='')
    # Infos expérience client (fiche publique)
    # {
    #   "wifi": "...", "reception": "...", "safety": "...",
    #   "dining": {"breakfast": "...", "restaurant": "...", "room_service": "..."},
    #   "wellness": "...", "room_guide": "...",
    #   "local_tips": [{"title": "...", "detail": "..."}]
    # }
    guest_info = models.JSONField(default=dict, blank=True)
    reference_prefix = models.CharField(max_length=15, default='HOT')

    # Messages email prédéfinis (agent réservations / paramètres)
    # Placeholders : {guest_name} {hotel_name} {reference} {check_in} {check_out}
    # {amount} {currency} {room_type} {payment_status} {reason}
    reservation_request_email_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {guest_name},\n\n'
            'Nous avons bien reçu votre demande de réservation chez {hotel_name}.\n\n'
            'Référence : {reference}\n'
            'Arrivée : {check_in}\n'
            'Départ : {check_out}\n'
            'Montant estimé : {amount} {currency}\n'
            'Statut paiement : {payment_status}\n\n'
            'L\'établissement confirmera ou refusera votre demande après validation.\n'
            'Vous recevrez un nouvel email dès qu\'une décision sera prise.\n\n'
            '— {hotel_name} via Isoko Hub\n'
        ),
        help_text='Email envoyé à la réception d\'une demande de réservation.',
    )
    reservation_confirm_email_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {guest_name},\n\n'
            'Bonne nouvelle : votre réservation chez {hotel_name} est confirmée.\n\n'
            'Référence : {reference}\n'
            'Arrivée : {check_in}\n'
            'Départ : {check_out}\n'
            'Type / chambre : {room_type}\n'
            'Montant : {amount} {currency}\n\n'
            'Présentez-vous à la réception le jour d\'arrivée avec votre référence.\n\n'
            '— {hotel_name} via Isoko Hub\n'
        ),
        help_text='Email envoyé lorsque l\'agent confirme la réservation.',
    )
    reservation_reject_email_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {guest_name},\n\n'
            'Votre demande de réservation chez {hotel_name} n\'a pas pu être acceptée.\n\n'
            'Référence : {reference}\n'
            'Arrivée prévue : {check_in}\n'
            'Départ prévu : {check_out}\n'
            'Motif : {reason}\n\n'
            'Vous pouvez effectuer une nouvelle demande ou contacter l\'établissement.\n\n'
            '— {hotel_name} via Isoko Hub\n'
        ),
        help_text='Email envoyé lorsque l\'agent refuse / annule la demande.',
    )
    check_in_email_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {guest_name},\n\n'
            'Bienvenue chez {hotel_name} ! Votre check-in est enregistré.\n\n'
            'Référence : {reference}\n'
            'Chambre : {room_number}\n'
            'Arrivée : {check_in}\n'
            'Départ prévu : {check_out}\n'
            'Heure d\'enregistrement : {actual_check_in}\n\n'
            'Nous vous souhaitons un excellent séjour.\n\n'
            '— {hotel_name} via Isoko Hub\n'
        ),
        help_text='Email envoyé au client après check-in (réception).',
    )
    check_out_email_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {guest_name},\n\n'
            'Votre check-out chez {hotel_name} est terminé. Merci de votre séjour.\n\n'
            'Référence : {reference}\n'
            'Chambre : {room_number}\n'
            'Facture : {invoice_number}\n'
            'Total : {invoice_total} {currency}\n'
            'Départ enregistré : {actual_check_out}\n\n'
            'À bientôt !\n\n'
            '— {hotel_name} via Isoko Hub\n'
        ),
        help_text='Email envoyé au client après check-out (réception).',
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.trade_name or self.business.name

    @property
    def display_stars(self):
        """Affichage public : étoiles vérifiées si présentes, sinon déclarées."""
        if self.classification_verified and self.stars_verified is not None:
            return self.stars_verified
        return self.stars


class HotelDepartment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_departments')
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('hotel', 'name')
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.hotel.name})'


class RoomType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='room_types')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default='')
    capacity_adults = models.PositiveSmallIntegerField(default=2)
    capacity_children = models.PositiveSmallIntegerField(default=0)
    bed_configuration = models.CharField(max_length=120, blank=True, default='')
    surface_m2 = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    amenities = models.JSONField(default=list, blank=True)
    base_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    photos = models.JSONField(default=list, blank=True)
    category = models.CharField(
        max_length=80,
        blank=True,
        default='',
        help_text='Libellé affiché côté client (ex. confort, luxe, suite)',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('hotel', 'name')
        ordering = ['name']

    def __str__(self):
        return self.name


class Room(models.Model):
    OPERATIONAL = (
        ('AVAILABLE', 'Disponible'),
        ('OCCUPIED', 'Occupée'),
        ('RESERVED', 'Réservée'),
        ('CLEANING', 'Nettoyage'),
        ('OUT_OF_SERVICE', 'Hors service'),
        ('MAINTENANCE', 'En maintenance'),
        ('BLOCKED', 'Bloquée'),
    )
    HOUSEKEEPING = (
        ('DIRTY', 'Sale'),
        ('CLEAN', 'Propre'),
        ('READY', 'Prête'),
        ('OCCUPIED', 'Occupée'),
        ('CLEANING_REQUIRED', 'Nettoyage requis'),
        ('INSPECTION', 'Inspection requise'),
        ('OUT_OF_SERVICE', 'Hors service'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_rooms')
    room_type = models.ForeignKey(RoomType, on_delete=models.PROTECT, related_name='rooms')
    number = models.CharField(max_length=30)
    floor = models.CharField(max_length=30, blank=True, default='')
    operational_status = models.CharField(max_length=30, choices=OPERATIONAL, default='AVAILABLE')
    housekeeping_status = models.CharField(max_length=30, choices=HOUSEKEEPING, default='READY')
    maintenance_status = models.CharField(max_length=30, blank=True, default='')
    amenities = models.JSONField(default=list, blank=True)
    commissioned_at = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('hotel', 'number')
        ordering = ['number']

    def __str__(self):
        return f'{self.number} ({self.hotel.name})'

    @property
    def is_bookable(self):
        if self.operational_status in ('MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE', 'OCCUPIED', 'CLEANING'):
            return False
        if self.housekeeping_status not in ('READY', 'CLEAN'):
            return False
        return self.is_active


class RatePlan(models.Model):
    RATE_KINDS = (
        ('STANDARD', 'Standard'),
        ('WEEKEND', 'Week-end'),
        ('HIGH_SEASON', 'Haute saison'),
        ('LOW_SEASON', 'Basse saison'),
        ('LONG_STAY', 'Longue durée'),
        ('GROUP', 'Groupe'),
        ('CORPORATE', 'Entreprise'),
        ('BREAKFAST', 'Petit-déjeuner inclus'),
    )
    CURRENCIES = (
        ('BIF', 'BIF'),
        ('USD', 'USD'),
        ('EUR', 'EUR'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='rate_plans')
    room_type = models.ForeignKey(RoomType, on_delete=models.CASCADE, related_name='rate_plans')
    name = models.CharField(max_length=120, default='Standard')
    rate_kind = models.CharField(max_length=30, choices=RATE_KINDS, default='STANDARD')
    price_per_night = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, choices=CURRENCIES, default='BIF')
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    min_nights = models.PositiveSmallIntegerField(default=1)
    includes_breakfast = models.BooleanField(default=False)
    taxes_included = models.BooleanField(default=False)
    cancellation_policy = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} — {self.room_type.name}'


class Guest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_guests')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='hotel_guest_profiles'
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=40, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    nationality = models.CharField(max_length=80, blank=True, default='')
    identity_reference = models.CharField(max_length=120, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.first_name} {self.last_name}'


class Reservation(models.Model):
    STATUS = (
        ('DRAFT', 'Brouillon'),
        ('PENDING', 'En attente'),
        ('CONFIRMED', 'Confirmée'),
        ('EXPECTED', 'Arrivée prévue'),
        ('CHECKED_IN', 'Client arrivé'),
        ('CHECKED_OUT', 'Client parti'),
        ('CANCELLED', 'Annulée'),
        ('NO_SHOW', 'No-show'),
        ('EXPIRED', 'Expirée'),
    )
    ACTIVE_STATUSES = ('PENDING', 'CONFIRMED', 'EXPECTED', 'CHECKED_IN')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=40, unique=True, db_index=True)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_reservations')
    guest = models.ForeignKey(Guest, on_delete=models.PROTECT, related_name='reservations')
    room_type = models.ForeignKey(RoomType, on_delete=models.PROTECT, related_name='reservations')
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='reservations')
    rate_plan = models.ForeignKey(RatePlan, on_delete=models.SET_NULL, null=True, blank=True, related_name='reservations')
    check_in_date = models.DateField()
    check_out_date = models.DateField()
    adults = models.PositiveSmallIntegerField(default=1)
    children = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS, default='PENDING')
    source = models.CharField(max_length=40, default='FRONT_DESK')
    special_requests = models.TextField(blank=True, default='')
    internal_notes = models.TextField(blank=True, default='')
    amount_per_night = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    PAYMENT_STATUS = (
        ('UNPAID', 'Non payé'),
        ('AWAITING_PIN', 'En attente validation PIN'),
        ('PAID', 'Payé'),
        ('FAILED', 'Échoué'),
        ('WAIVED', 'Exonéré'),
        ('REFUNDED', 'Remboursé'),
    )
    payment_status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS, default='UNPAID', db_index=True,
    )
    payment_method = models.CharField(max_length=40, blank=True, default='')
    payer_phone = models.CharField(max_length=40, blank=True, default='')
    payment_provider_reference = models.CharField(max_length=120, blank=True, default='')
    payment_merchant_account = models.CharField(max_length=80, blank=True, default='')
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_note = models.CharField(max_length=255, blank=True, default='')

    # Décision hôtel (confirmation / refus) visible côté client
    decision_note = models.TextField(
        blank=True, default='',
        help_text='Message de confirmation ou de refus visible par le client',
    )
    decision_at = models.DateTimeField(null=True, blank=True)

    # Demande client : anticiper ou reporter les dates
    RESCHEDULE_STATUS = (
        ('NONE', 'Aucune'),
        ('PENDING', 'En attente'),
        ('ACCEPTED', 'Acceptée'),
        ('REFUSED', 'Refusée'),
    )
    reschedule_status = models.CharField(
        max_length=20, choices=RESCHEDULE_STATUS, default='NONE', db_index=True,
    )
    reschedule_preferred_check_in = models.DateField(null=True, blank=True)
    reschedule_preferred_check_out = models.DateField(null=True, blank=True)
    reschedule_reason = models.TextField(blank=True, default='')
    reschedule_admin_note = models.TextField(blank=True, default='')
    reschedule_requested_at = models.DateTimeField(null=True, blank=True)
    reschedule_resolved_at = models.DateTimeField(null=True, blank=True)

    # Alerte J-1 avant check-out (staff + client)
    departure_reminder_sent_at = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text='Date d’envoi de l’alerte « séjour se termine demain »',
    )
    departure_reminder_note = models.TextField(
        blank=True, default='',
        help_text='Message visible par le client sur l’historique (rappel de départ)',
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='hotel_reservations_created'
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def nights(self):
        return max((self.check_out_date - self.check_in_date).days, 0)

    def __str__(self):
        return self.reference


class Stay(models.Model):
    STATUS = (
        ('IN_HOUSE', 'En séjour'),
        ('CHECKED_OUT', 'Parti'),
        ('CANCELLED', 'Annulé'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.OneToOneField(Reservation, on_delete=models.PROTECT, related_name='stay')
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_stays')
    guest = models.ForeignKey(Guest, on_delete=models.PROTECT, related_name='stays')
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='stays')
    actual_check_in = models.DateTimeField(default=timezone.now)
    actual_check_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default='IN_HOUSE')
    notes = models.TextField(blank=True, default='')
    previous_room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='previous_stays'
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-actual_check_in']

    def __str__(self):
        return f'Stay {self.guest} — {self.room.number}'


class HotelService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_services')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default='')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    unit = models.CharField(max_length=40, default='unité')
    currency = models.CharField(max_length=10, default='BIF')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('hotel', 'name')
        ordering = ['name']

    def __str__(self):
        return self.name


class Folio(models.Model):
    STATUS = (
        ('OPEN', 'Ouvert'),
        ('CLOSED', 'Fermé'),
        ('VOID', 'Annulé'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stay = models.OneToOneField(Stay, on_delete=models.CASCADE, related_name='folio')
    guest = models.ForeignKey(Guest, on_delete=models.PROTECT, related_name='folios')
    status = models.CharField(max_length=20, choices=STATUS, default='OPEN')
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    taxes = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    discounts = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def recalculate(self):
        items = self.items.all()
        self.subtotal = sum((i.total for i in items), Decimal('0'))
        self.total = self.subtotal + self.taxes - self.discounts
        self.paid_amount = sum(
            (p.amount for p in self.payments.filter(status='PAID')),
            Decimal('0'),
        )
        self.balance = self.total - self.paid_amount
        self.save(update_fields=['subtotal', 'total', 'paid_amount', 'balance', 'updated_at'])


class FolioItem(models.Model):
    ITEM_TYPES = (
        ('NIGHT', 'Nuitée'),
        ('SERVICE', 'Service'),
        ('TAX', 'Taxe'),
        ('DISCOUNT', 'Remise'),
        ('OTHER', 'Autre'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    folio = models.ForeignKey(Folio, on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES, default='SERVICE')
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1'))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    hotel_service = models.ForeignKey(HotelService, on_delete=models.SET_NULL, null=True, blank=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):
        self.total = (self.quantity or Decimal('0')) * (self.unit_price or Decimal('0'))
        super().save(*args, **kwargs)


class Payment(models.Model):
    METHODS = (
        ('CASH', 'Espèces'),
        ('TRANSFER', 'Virement'),
        ('CARD', 'Carte'),
        ('MOBILE_MONEY', 'Mobile money'),
        ('BURUNDIPAY', 'BurundiPay'),
        ('OTHER', 'Autre'),
    )
    STATUS = (
        ('PENDING', 'En attente'),
        ('AWAITING_PIN', 'En attente PIN'),
        ('PARTIAL', 'Partiel'),
        ('PAID', 'Payé'),
        ('FAILED', 'Échoué'),
        ('REFUNDED', 'Remboursé'),
        ('CANCELLED', 'Annulé'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    folio = models.ForeignKey(Folio, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHODS, default='CASH')
    status = models.CharField(max_length=20, choices=STATUS, default='PAID')
    reference = models.CharField(max_length=100, blank=True, default='')
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    paid_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default='')


class HotelInvoice(models.Model):
    STATUS = (
        ('ISSUED', 'Émise'),
        ('PAID', 'Payée'),
        ('PARTIAL', 'Partielle'),
        ('CANCELLED', 'Annulée'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=40, unique=True, db_index=True)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_invoices')
    stay = models.ForeignKey(Stay, on_delete=models.PROTECT, related_name='invoices')
    folio = models.ForeignKey(Folio, on_delete=models.PROTECT, related_name='invoices')
    guest_name = models.CharField(max_length=200)
    period_start = models.DateField()
    period_end = models.DateField()
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    taxes = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    discounts = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    status = models.CharField(max_length=20, choices=STATUS, default='ISSUED')
    snapshot = models.JSONField(default=dict, blank=True)
    issued_at = models.DateTimeField(default=timezone.now)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ['-issued_at']


class HousekeepingTask(models.Model):
    TASK_TYPES = (
        ('CLEANING', 'Nettoyage'),
        ('INSPECTION', 'Inspection'),
        ('TURNOVER', 'Rotation'),
        ('OTHER', 'Autre'),
    )
    PRIORITY = (('LOW', 'Basse'), ('NORMAL', 'Normale'), ('HIGH', 'Haute'), ('URGENT', 'Urgente'))
    STATUS = (
        ('PENDING', 'En attente'),
        ('ASSIGNED', 'Assignée'),
        ('IN_PROGRESS', 'En cours'),
        ('DONE', 'Terminée'),
        ('CANCELLED', 'Annulée'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hk_tasks')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='hk_tasks')
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='hk_tasks'
    )
    task_type = models.CharField(max_length=20, choices=TASK_TYPES, default='CLEANING')
    priority = models.CharField(max_length=20, choices=PRIORITY, default='NORMAL')
    status = models.CharField(max_length=20, choices=STATUS, default='PENDING')
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class MaintenanceTicket(models.Model):
    PRIORITY = (('LOW', 'Basse'), ('NORMAL', 'Normale'), ('HIGH', 'Haute'), ('URGENT', 'Urgente'))
    STATUS = (
        ('NEW', 'Nouveau'),
        ('ASSIGNED', 'Assigné'),
        ('IN_PROGRESS', 'En cours'),
        ('WAITING', 'En attente'),
        ('RESOLVED', 'Résolu'),
        ('CLOSED', 'Fermé'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='maintenance_tickets')
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='maintenance_tickets')
    category = models.CharField(max_length=80, blank=True, default='')
    description = models.TextField()
    priority = models.CharField(max_length=20, choices=PRIORITY, default='NORMAL')
    status = models.CharField(max_length=20, choices=STATUS, default='NEW')
    blocks_room = models.BooleanField(default=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='maintenance_assigned'
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='maintenance_opened'
    )
    cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    comment = models.TextField(blank=True, default='')
    opened_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-opened_at']


class HotelAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hotel_audit_logs')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    action = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=64, blank=True, default='')
    old_value = models.JSONField(default=dict, blank=True)
    new_value = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class CashClosing(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hotel = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='cash_closings')
    period_date = models.DateField()
    total_collected = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    breakdown = models.JSONField(
        default=dict, blank=True,
        help_text='Répartition par méthode + compteurs au moment de la clôture',
    )
    notes = models.TextField(blank=True, default='')
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    closed_at = models.DateTimeField(default=timezone.now)
    is_locked = models.BooleanField(default=True)

    class Meta:
        unique_together = ('hotel', 'period_date')
        ordering = ['-period_date']
