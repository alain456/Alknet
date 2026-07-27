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
