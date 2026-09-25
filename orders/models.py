import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from businesses.models import Business
from products.models import Product, ProductVariant


class Order(models.Model):
    """
    Commande Commerce (retrait uniquement) + legacy bookings métier générique.
    Paiement BurundiPay avant acceptation par le commerçant.
    """
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('CONFIRMED', 'Confirmée'),
        ('READY', 'Prête au retrait'),
        ('COMPLETED', 'Terminée / retirée'),
        ('CANCELLED', 'Annulée'),
        ('REJECTED', 'Refusée'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('UNPAID', 'Non payée'),
        ('AWAITING_PIN', 'En attente PIN BurundiPay'),
        ('PAID', 'Payée'),
        ('FAILED', 'Échec paiement'),
        ('REFUNDED', 'Remboursée'),
    )

    FULFILLMENT_CHOICES = (
        ('PICKUP', 'Retrait en magasin'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='BIF')

    # Invité
    guest_name = models.CharField(max_length=200, blank=True, default='')
    guest_email = models.EmailField(blank=True, default='')
    guest_phone = models.CharField(max_length=30, blank=True, default='')

    fulfillment_type = models.CharField(max_length=20, choices=FULFILLMENT_CHOICES, default='PICKUP')
    shipping_address = models.TextField(blank=True, null=True)  # legacy / non utilisé (retrait)
    contact_phone = models.CharField(max_length=30, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    reference_code = models.CharField(max_length=40, blank=True, default='', db_index=True)

    # Paiement BurundiPay
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='UNPAID')
    payment_method = models.CharField(max_length=40, blank=True, default='')
    payer_phone = models.CharField(max_length=30, blank=True, default='')
    payment_merchant_account = models.CharField(max_length=120, blank=True, default='')
    payment_provider_reference = models.CharField(max_length=120, blank=True, default='')
    payment_note = models.CharField(max_length=255, blank=True, default='')
    paid_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.reference_code or f'Order {self.id}'

    @property
    def client_display_name(self):
        if self.customer_id:
            return self.customer.get_full_name() or self.customer.email
        return self.guest_name or 'Invité'

    @property
    def client_email(self):
        if self.customer_id and self.customer.email:
            return self.customer.email
        return self.guest_email


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, related_name='order_items',
    )
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_items',
    )
    product_name = models.CharField(max_length=255, blank=True, default='')
    variant_label = models.CharField(max_length=120, blank=True, default='')
    quantity = models.PositiveIntegerField(default=1)
    price_at_time = models.DecimalField(max_digits=14, decimal_places=2)

    def __str__(self):
        return f'{self.quantity}x {self.product_name or self.product}'


class Cart(models.Model):
    """Panier client ou invité (session_key) pour une boutique."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='carts')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='commerce_carts',
    )
    session_key = models.CharField(max_length=64, blank=True, default='', db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def recalculate(self):
        return sum(
            (item.unit_price * item.quantity) for item in self.items.select_related('product', 'variant')
        )


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='cart_items')
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name='cart_items',
    )
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['cart', 'product', 'variant'],
                name='uniq_cart_product_variant',
            ),
        ]

    @property
    def unit_price(self):
        if self.variant_id:
            return self.variant.unit_price
        return self.product.effective_price
