import uuid
from django.db import models
from django.conf import settings
from business_categories.models import BusinessCategory
from django.utils import timezone

class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='businesses')
    category = models.ForeignKey(BusinessCategory, on_delete=models.SET_NULL, null=True, related_name='businesses')
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Businesses"
        ordering = ['-created_at']

    def __str__(self):
        return self.name
