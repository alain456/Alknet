import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from businesses.models import Business


class RetailPharmacyProfile(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Brouillon'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspendue'),
        ('CLOSED', 'Fermee'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        Business, on_delete=models.CASCADE, related_name='retail_profile'
    )
    commercial_name = models.CharField(max_length=255, blank=True)
    license_number = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    order_reference_prefix = models.CharField(max_length=20, default='CMD-PD')
    acceptance_email_message = models.TextField(
        blank=True,
        default=(
            'Bonjour {patient_name},\n\nVotre commande {reference} a ete acceptee par '
            '{pharmacy_name}.\nMontant total : {total_amount} {currency}.\n\n'
            'Cordialement,\n{pharmacy_name}'
        ),
    )
    is_open_for_orders = models.BooleanField(
        default=True,
        help_text='Si False, les nouvelles commandes patients sont bloquées.',
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.commercial_name or self.business.name


class RetailProduct(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Actif'),
        ('INACTIVE', 'Inactif'),
        ('ARCHIVED', 'Archive'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    retail_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='retail_products'
    )
    name = models.CharField(max_length=255)
    active_ingredient = models.CharField(max_length=255, blank=True)
    dosage = models.CharField(max_length=120, blank=True)
    pharmaceutical_form = models.CharField(max_length=120, blank=True)
    administration_route = models.CharField(max_length=120, blank=True)
    manufacturer = models.CharField(max_length=255, blank=True)
    packaging = models.CharField(max_length=255)
    sales_unit = models.CharField(max_length=120, default='Boite')
    retail_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    prescription_required = models.BooleanField(default=False)
    quantity_real = models.PositiveIntegerField(default=0)
    quantity_reserved = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=10)
    batch_number = models.CharField(max_length=120, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    description = models.TextField(blank=True)
    therapeutic_class = models.CharField(max_length=120, blank=True)
    image_url = models.TextField(blank=True)
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


class RetailOrder(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Brouillon'),
        ('SUBMITTED', 'Envoyee'),
        ('PROCESSING', 'En cours de traitement'),
        ('CLARIFICATION_REQUESTED', 'Clarification demandee'),
        ('ACCEPTED', 'Acceptee'),
        ('REJECTED', 'Refusee'),
        ('CANCELLED', 'Annulee'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=40, unique=True, blank=True)
    retail_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='retail_orders_received'
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_orders',
    )
    patient_name = models.CharField(max_length=255)
    patient_email = models.EmailField()
    patient_phone = models.CharField(max_length=40, blank=True)
    is_guest = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_orders_created',
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    # Paiement client → marchand pharmacie (BurundiPay), comme les consultations hôpital
    PAYMENT_STATUS_CHOICES = (
        ('UNPAID', 'Non payée'),
        ('AWAITING_PIN', 'En attente PIN BurundiPay'),
        ('PAID', 'Payée'),
        ('FAILED', 'Échec paiement'),
        ('REFUNDED', 'Remboursée'),
    )
    payment_status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS_CHOICES, default='UNPAID'
    )
    payment_method = models.CharField(
        max_length=40, blank=True,
        help_text='Ex: BURUNDIPAY, CASH, FREE',
    )
    payer_phone = models.CharField(
        max_length=40, blank=True,
        help_text='Numéro BurundiPay du client (payeur)',
    )
    payment_merchant_account = models.CharField(max_length=120, blank=True)
    payment_provider_reference = models.CharField(max_length=120, blank=True)
    payment_note = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_orders_marked_paid',
    )
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    rejection_reason = models.CharField(max_length=255, blank=True)
    rejection_comment = models.TextField(blank=True)
    clarification_comment = models.TextField(blank=True)
    notification_email = models.EmailField(blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_orders_accepted',
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_orders_rejected',
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.reference or str(self.id)


class RetailOrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(RetailOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        RetailProduct, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='order_items',
    )
    product_name_snapshot = models.CharField(max_length=255)
    packaging_snapshot = models.CharField(max_length=255)
    sales_unit_snapshot = models.CharField(max_length=120, blank=True)
    unit_price_snapshot = models.DecimalField(max_digits=14, decimal_places=2)
    prescription_required_snapshot = models.BooleanField(default=False)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['product_name_snapshot']


class RetailOrderEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(RetailOrder, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=60)
    message = models.TextField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_order_events',
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class StockMovement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(RetailProduct, on_delete=models.CASCADE, related_name='movements')
    old_quantity = models.IntegerField()
    new_quantity = models.IntegerField()
    difference = models.IntegerField()
    reason = models.CharField(max_length=255)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_stock_movements',
    )
    order = models.ForeignKey(
        RetailOrder, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_movements',
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class RetailCart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='retail_carts'
    )
    retail_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='retail_carts_as_supplier'
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('patient', 'retail_business')


class RetailCartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(RetailCart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(RetailProduct, on_delete=models.CASCADE)
    product_name_snapshot = models.CharField(max_length=255, blank=True)
    packaging_snapshot = models.CharField(max_length=255, blank=True)
    sales_unit_snapshot = models.CharField(max_length=120, blank=True)
    unit_price_snapshot = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    quantity = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('cart', 'product')

    @property
    def line_total(self):
        return (self.unit_price_snapshot or self.product.retail_price) * self.quantity


class ProformaInvoice(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Brouillon'),
        ('PENDING_VALIDATION', 'En attente de validation'),
        ('CONFIRMED', 'Confirmee'),
        ('CANCELLED', 'Annulee'),
        ('REJECTED', 'Refusee'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=40, unique=True)
    cart = models.ForeignKey(
        RetailCart, on_delete=models.SET_NULL, null=True, blank=True, related_name='proformas'
    )
    order = models.OneToOneField(
        RetailOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='proforma'
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_proformas',
    )
    patient_name = models.CharField(max_length=255)
    patient_email = models.EmailField()
    retail_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='retail_proformas_issued'
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
        return self.reference


class Prescription(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('REVIEWED', 'Examinee'),
        ('ACCEPTED', 'Acceptee'),
        ('REJECTED', 'Refusee'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    retail_business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='retail_prescriptions'
    )
    order = models.ForeignKey(
        RetailOrder, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='prescriptions',
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_prescriptions',
    )
    patient_name = models.CharField(max_length=255)
    patient_email = models.EmailField()
    file = models.FileField(
        upload_to='retail/prescriptions/%Y/%m/',
        blank=True,
        null=True,
        help_text='Fichier ordonnance (image ou PDF)',
    )
    file_url = models.TextField(
        blank=True,
        default='',
        help_text='URL d’accès (média ou legacy data-URI / URL externe)',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    review_comment = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='retail_prescriptions_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class NotificationLog(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('SENT', 'Envoye'),
        ('FAILED', 'Echec'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        RetailOrder, on_delete=models.CASCADE, related_name='notification_logs'
    )
    recipient_email = models.EmailField()
    notification_type = models.CharField(max_length=40, default='ORDER_ACCEPTED')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
