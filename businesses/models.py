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
    
    VERIFICATION_STATUS_CHOICES = (
        ('APPROVED', 'Approuvé'),
        ('PENDING', 'En attente de validation'),
        ('REJECTED', 'Rejeté'),
    )

    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
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
        parts = [p for p in [self.address, self.avenue, self.quartier, self.zone, self.commune, self.province] if p]
        return ", ".join(parts) if parts else "Adresse non renseignée"

    def save(self, *args, **kwargs):
        if not self.address:
            hierarchical_parts = [p for p in [self.avenue, self.quartier, self.zone, self.commune, self.province] if p]
            if hierarchical_parts:
                self.address = ", ".join(hierarchical_parts)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class BusinessEmployee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='employments')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='employees')
    position = models.CharField(max_length=100, default='Staff')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('user', 'business')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.business.name} ({self.position})"
