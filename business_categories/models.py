import uuid
from django.db import models
from django.utils import timezone

class BusinessCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=255, blank=True, help_text="Nom de l'icône ou URL")
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Business Categories"
        ordering = ['name']

    def __str__(self):
        return self.name
