
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from businesses.models import Business


class WholesalePharmacyProfile(models.Model):
    """Profil B2B rattache a une entreprise categorie Pharmacie de gros."""
    STATUS_CHOICES = (
        ('DRAFT', 'Brouillon'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspendue'),
        ('CLOSED', 'Fermee'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        Business, on_delete=models.CASCADE, related_name='wholesale_profile'
    )
    commercial_name = models.CharField(max_length=255, blank=True)
    license_number = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    order_reference_prefix = models.CharField(max_length=20, default='CMD-PG')
    acceptance_email_message = models.TextField(
        blank=True,
        default=(
            'Bonjour,\n\nVotre commande {reference} a ete acceptee par {wholesale_name}.\n'
            'Montant total : {total_amount} {currency}.\n\n'
            'Merci de nous contacter pour la suite de la collaboration.\n\n'
            'Cordialement,\n{wholesale_name}'
        ),
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.commercial_name or self.business.name


class WholesaleProduct(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Actif'),
        ('INACTIVE', 'Inactif'),
        ('ARCHIVED', 'Archive'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wholesale_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='wholesale_products'
    )
    name = models.CharField(max_length=255)
    active_ingredient = models.CharField(max_length=255, blank=True)
    dosage = models.CharField(max_length=120, blank=True)
    pharmaceutical_form = models.CharField(max_length=120, blank=True)
    administration_route = models.CharField(max_length=120, blank=True)
    manufacturer = models.CharField(max_length=255, blank=True)
    packaging = models.CharField(max_length=255, help_text='Ex: Boite de 20 comprimes')
    wholesale_unit = models.CharField(max_length=120, default='Boite')
    min_order_quantity = models.PositiveIntegerField(default=1)
    wholesale_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    quantity_real = models.PositiveIntegerField(default=0)
    quantity_reserved = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=10)
    batch_number = models.CharField(max_length=120, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    description = models.TextField(blank=True)
    therapeutic_class = models.CharField(max_length=120, blank=True, help_text='Ex: Antidouleur, Antibiotique')
    image_url = models.TextField(blank=True, help_text='Image du medicament (URL ou data URI)')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    @property
    def quantity_available(self):
        return max(0, int(self.quantity_real) - int(self.quantity_reserved))

    @property
    def stock_status(self):
        if self.expiration_date and self.expiration_date < timezone.now().date():
            return 'EXPIRED'
        if self.quantity_available <= 0:
            return 'OUT_OF_STOCK'
        if self.quantity_available <= self.low_stock_threshold:
            return 'LOW_STOCK'
        if self.quantity_reserved > 0:
            return 'RESERVED'
        return 'AVAILABLE'

    def __str__(self):
        return f'{self.name} ({self.packaging})'


class StockMovement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(WholesaleProduct, on_delete=models.CASCADE, related_name='movements')
    old_quantity = models.IntegerField()
    new_quantity = models.IntegerField()
    difference = models.IntegerField()
    reason = models.CharField(max_length=255)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    order = models.ForeignKey(
        'WholesaleOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements'
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class WholesaleOrder(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Brouillon'),
        ('SUBMITTED', 'Envoyee'),
        ('PROCESSING', 'En cours de traitement'),
        ('ACCEPTED', 'Acceptee'),
        ('REJECTED', 'Refusee'),
        ('CANCELLED', 'Annulee'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=40, unique=True, blank=True)
    wholesale_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='wholesale_orders_received'
    )
    client_business = models.ForeignKey(
        Business, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wholesale_orders_placed'
    )
    BUYER_TYPE_CHOICES = (
        ('PERSON', 'Personne'),
        ('RETAIL_PHARMACY', 'Pharmacie de detail'),
    )
    buyer_type = models.CharField(max_length=30, choices=BUYER_TYPE_CHOICES, default='RETAIL_PHARMACY')
    buyer_name = models.CharField(max_length=255, blank=True)
    buyer_email = models.EmailField(blank=True)
    buyer_phone = models.CharField(max_length=40, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='wholesale_orders_created'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    # Paiement acheteur → marchand grossiste (Lumicash)
    PAYMENT_STATUS_CHOICES = (
        ('UNPAID', 'Non payée'),
        ('AWAITING_PIN', 'En attente PIN Lumicash'),
        ('PAID', 'Payée'),
        ('FAILED', 'Échec paiement'),
        ('REFUNDED', 'Remboursée'),
    )
    payment_status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS_CHOICES, default='UNPAID'
    )
    payment_method = models.CharField(
        max_length=40, blank=True,
        help_text='Ex: LUMICASH, CASH, FREE',
    )
    payer_phone = models.CharField(
        max_length=40, blank=True,
        help_text='Numéro Lumicash de l\'acheteur (payeur)',
    )
    payment_merchant_account = models.CharField(max_length=120, blank=True)
    payment_provider_reference = models.CharField(max_length=120, blank=True)
    payment_note = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wholesale_orders_marked_paid',
    )
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    refusal_reason = models.CharField(max_length=255, blank=True)
    refusal_comment = models.TextField(blank=True)
    notification_email = models.EmailField(blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wholesale_orders_accepted'
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    refused_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wholesale_orders_refused'
    )
    refused_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.reference or str(self.id)


class WholesaleOrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(WholesaleOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        WholesaleProduct, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_items'
    )
    product_name_snapshot = models.CharField(max_length=255)
    packaging_snapshot = models.CharField(max_length=255)
    wholesale_unit_snapshot = models.CharField(max_length=120, blank=True)
    unit_price_snapshot = models.DecimalField(max_digits=14, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['product_name_snapshot']


class WholesaleOrderEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(WholesaleOrder, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=60)
    message = models.TextField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class WholesaleCart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='wholesale_carts'
    )
    wholesale_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='wholesale_carts_as_supplier'
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('client_business', 'wholesale_business')


class WholesaleCartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(WholesaleCart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(WholesaleProduct, on_delete=models.CASCADE)
    product_name_snapshot = models.CharField(max_length=255, blank=True)
    packaging_snapshot = models.CharField(max_length=255, blank=True)
    wholesale_unit_snapshot = models.CharField(max_length=120, blank=True)
    unit_price_snapshot = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    quantity = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('cart', 'product')

    @property
    def line_total(self):
        price = self.unit_price_snapshot or getattr(self.product, 'wholesale_price', Decimal('0'))
        return price * self.quantity


class ProformaInvoice(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Brouillon'),
        ('PENDING_VALIDATION', 'En attente de validation'),
        ('CONFIRMED', 'Confirmee'),
        ('CANCELLED', 'Annulee'),
        ('REJECTED', 'Refusee'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=40, blank=True)
    cart = models.ForeignKey(
        WholesaleCart, on_delete=models.SET_NULL, null=True, blank=True, related_name='proformas'
    )
    order = models.OneToOneField(
        WholesaleOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='proforma'
    )
    client_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='wholesale_proformas'
    )
    wholesale_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='wholesale_proformas_issued'
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    lines_snapshot = models.JSONField(default=list, blank=True)
    generated_at = models.DateTimeField(default=timezone.now)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return self.reference or str(self.id)


class NotificationLog(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('SENT', 'Envoye'),
        ('FAILED', 'Echec'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        WholesaleOrder, on_delete=models.CASCADE, related_name='notification_logs'
    )
    recipient_business = models.ForeignKey(
        Business, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wholesale_notifications'
    )
    recipient_email = models.EmailField()
    notification_type = models.CharField(max_length=40, default='ORDER_ACCEPTED')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
