import uuid
from django.db import models
from django.conf import settings
from service_categories.models import ServiceCategory
from businesses.models import Business
from django.utils import timezone

class Service(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(ServiceCategory, on_delete=models.SET_NULL, null=True, related_name='services')
    
    # A service can belong to a business or directly to an individual professional
    business = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True, related_name='services')
    professional = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='individual_services')
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    availability = models.CharField(max_length=255, blank=True, help_text="Ex: Lundi-Vendredi 8h-17h")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    image_urls = models.JSONField(default=list, blank=True)
    tags = models.JSONField(default=list, blank=True)
    
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    reviews_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

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


def refresh_service_rating(service):
    from django.db.models import Avg, Count
    stats = service.reviews.aggregate(avg=Avg('score'), n=Count('id'))
    service.rating = round(stats['avg'] or 0, 2)
    service.reviews_count = stats['n'] or 0
    service.save(update_fields=['rating', 'reviews_count', 'updated_at'])
    return service
