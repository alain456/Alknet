import secrets
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from businesses.models import Business
from service_categories.models import ServiceCategory

class Service(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(ServiceCategory, on_delete=models.SET_NULL, null=True, related_name='services')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='grouped_services',
    )

    # A service can belong to a business or directly to an individual professional
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True, related_name='services')
    professional = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='individual_services')
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    coverage_zone = models.CharField(max_length=255, blank=True, default='')
    availability = models.CharField(max_length=255, blank=True, help_text="Ex: Lundi-Vendredi 8h-17h")
    modalities = models.TextField(blank=True, default='')
    sort_order = models.PositiveIntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    image_urls = models.JSONField(default=list, blank=True)
    tags = models.JSONField(default=list, blank=True)
    
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    reviews_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'business']),
            models.Index(fields=['parent', 'sort_order']),
            models.Index(fields=['title']),
        ]

    def __str__(self):
        return self.title


class ServiceReview(models.Model):
    """Avis client sur un service de l'annuaire (une note par personne)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='reviews')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='service_reviews',
    )
    score = models.PositiveSmallIntegerField()
    comment = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['service', 'author'], name='uniq_service_review_author'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.score}/5 · {self.service_id}'


class ServiceSubItem(models.Model):
    """Sous-service rattaché à une offre (ex. aide aux devoirs dans Garde d'enfants)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='sub_items')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['sort_order', 'title']
        indexes = [
            models.Index(fields=['title']),
        ]

    def __str__(self):
        return self.title


class ServiceProviderProfile(models.Model):
    """Fiche publique du prestataire (entreprise, cabinet ou indépendant)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(
        Business, on_delete=models.CASCADE, related_name='service_provider_profile',
    )
    commercial_name = models.CharField(max_length=255, blank=True, default='')
    about = models.TextField(blank=True, default='')
    coverage_zones = models.TextField(
        blank=True, default='',
        help_text='Zones ou adresses où les services sont proposés.',
    )
    opening_hours = models.CharField(max_length=255, blank=True, default='')
    show_phone = models.BooleanField(default=True)
    show_email = models.BooleanField(default=True)
    show_address = models.BooleanField(default=True)
    show_website = models.BooleanField(default=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['is_published']),
        ]

    def display_name(self):
        return (self.commercial_name or self.business.name or '').strip()

    def __str__(self):
        return self.display_name()


class TeamMember(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='service_team')
    name = models.CharField(max_length=255)
    role_title = models.CharField(max_length=255, blank=True, default='')
    qualifications = models.TextField(blank=True, default='')
    experience = models.TextField(blank=True, default='')
    photo_url = models.TextField(blank=True, default='')
    is_public = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class ProviderDocument(models.Model):
    KIND_CHOICES = (
        ('ACTIVITY', 'Image d’activité'),
        ('TESTIMONY', 'Vidéo témoignage'),
        ('CERTIFICATE', 'Certificat'),
        ('ATTESTATION', 'Attestation'),
        ('OTHER', 'Autre justificatif'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='service_documents')
    title = models.CharField(max_length=255)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='ACTIVITY')
    description = models.TextField(blank=True, default='')
    file_url = models.TextField(blank=True, default='')
    is_public = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', '-created_at']

    def __str__(self):
        return self.title


class ContactRequest(models.Model):
    STATUS_CHOICES = (
        ('NEW', 'Nouvelle'),
        ('IN_PROGRESS', 'En cours'),
        ('REPLIED', 'Répondue'),
        ('CLOSED', 'Clôturée'),
    )
    CONTACT_CHOICES = (
        ('PHONE', 'Téléphone'),
        ('EMAIL', 'E-mail'),
        ('EITHER', 'Indifférent'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='service_contact_requests')
    service = models.ForeignKey(
        Service, on_delete=models.SET_NULL, null=True, blank=True, related_name='contact_requests',
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='service_contact_requests',
    )
    client_name = models.CharField(max_length=255)
    client_email = models.EmailField()
    client_phone = models.CharField(max_length=40, blank=True, default='')
    client_address = models.CharField(max_length=255, blank=True, default='')
    preferred_contact = models.CharField(max_length=10, choices=CONTACT_CHOICES, default='EITHER')
    message = models.TextField()
    reference = models.CharField(max_length=24, unique=True)
    public_token = models.CharField(max_length=48, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['business', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.public_token:
            self.public_token = secrets.token_urlsafe(24)[:48]
        if not self.reference and self.business_id:
            self.reference = allocate_request_reference(self.business)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.reference or self.client_name} → {self.business_id}'


class ContactMessage(models.Model):
    KIND_CHOICES = (
        ('CLIENT', 'Client'),
        ('PROVIDER', 'Prestataire'),
        ('INTERNAL', 'Note interne'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(ContactRequest, on_delete=models.CASCADE, related_name='thread')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='service_contact_messages',
    )
    kind = models.CharField(max_length=12, choices=KIND_CHOICES)
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.kind} {self.request_id}'


def request_prefix(business):
    raw = (getattr(business, 'name', None) or 'DEM')
    letters = ''.join(ch for ch in str(raw).upper() if ch.isalnum())[:6]
    return letters or 'DEM'


def allocate_request_reference(business):
    prefix = request_prefix(business)
    n = ContactRequest.objects.filter(business_id=business.pk).count() + 1
    for _ in range(40):
        candidate = f'{prefix}-{n:04d}'
        if not ContactRequest.objects.filter(reference=candidate).exists():
            return candidate
        n += 1
    return f'{prefix}-{uuid.uuid4().hex[:6].upper()}'


def refresh_service_rating(service):
    from django.db.models import Avg, Count
    stats = service.reviews.aggregate(avg=Avg('score'), n=Count('id'))
    service.rating = round(stats['avg'] or 0, 2)
    service.reviews_count = stats['n'] or 0
    service.save(update_fields=['rating', 'reviews_count', 'updated_at'])
    return service
