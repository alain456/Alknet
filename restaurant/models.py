import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from businesses.models import Business


class RestaurantProfile(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Actif'),
        ('SUSPENDED', 'Suspendu'),
        ('CLOSED', 'Fermé'),
    )
    VENUE_KINDS = (
        ('RESTAURANT', 'Restaurant'),
        ('BAR', 'Bar'),
        ('CAFE', 'Café'),
        ('TRAITEUR', 'Traiteur'),
    )
    PRICE_RANGES = (
        ('', 'Non renseigné'),
        ('1', 'Abordable'),
        ('2', 'Moyen'),
        ('3', 'Élevé'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        Business, on_delete=models.CASCADE, related_name='restaurant_profile',
    )
    trade_name = models.CharField(max_length=255, blank=True, default='')
    venue_kind = models.CharField(max_length=20, choices=VENUE_KINDS, default='RESTAURANT')
    cuisine_type = models.CharField(max_length=120, blank=True, default='')
    seats = models.PositiveSmallIntegerField(null=True, blank=True)
    opening_hours = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    takeaway = models.BooleanField(default=False)
    delivery = models.BooleanField(default=False)
    reservations_open = models.BooleanField(default=True)
    price_range = models.CharField(max_length=2, choices=PRICE_RANGES, blank=True, default='')
    gallery = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Fiche restauration'
        verbose_name_plural = 'Fiches restauration'

    def __str__(self):
        return self.trade_name or getattr(self.business, 'name', str(self.pk))


class MenuItem(models.Model):
    SECTIONS = (
        ('entrees', 'Entrées'),
        ('plats', 'Plats'),
        ('desserts', 'Desserts'),
        ('boissons', 'Boissons'),
        ('autre', 'Autre'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='menu_items',
    )
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True, default='')
    section = models.CharField(max_length=20, choices=SECTIONS, default='plats')
    price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    currency = models.CharField(max_length=10, default='BIF')
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['restaurant', 'is_available']),
        ]

    def __str__(self):
        return self.name


class TableBooking(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'En attente'),
        ('CONFIRMED', 'Confirmée'),
        ('REFUSED', 'Refusée'),
        ('CANCELLED', 'Annulée'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name='table_bookings',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='table_bookings',
    )
    guest_name = models.CharField(max_length=160)
    guest_phone = models.CharField(max_length=50, blank=True, default='')
    guest_email = models.EmailField(blank=True, default='')
    party_size = models.PositiveSmallIntegerField(default=2)
    booked_for = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, default='')
    manager_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-booked_for', '-created_at']
        indexes = [
            models.Index(fields=['restaurant', 'status']),
            models.Index(fields=['restaurant', 'booked_for']),
        ]

    def __str__(self):
        return f'{self.guest_name} · {self.booked_for}'
