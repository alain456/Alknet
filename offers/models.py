import uuid
from django.db import models
from django.conf import settings
from businesses.models import Business
from django.utils import timezone

class Offer(models.Model):
    OFFER_TYPES = (
        ('FULL_TIME', 'Full-time'),
        ('PART_TIME', 'Part-time'),
        ('CONTRACT', 'Contract'),
        ('FREELANCE', 'Freelance'),
        ('INTERNSHIP', 'Internship'),
    )
    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
        ('DRAFT', 'Draft'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='offers')
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    offer_type = models.CharField(max_length=20, choices=OFFER_TYPES, default='FULL_TIME')
    
    required_skills = models.JSONField(default=list, blank=True, help_text='["Python", "Django", "React"]')
    salary_range = models.CharField(max_length=100, blank=True, help_text='e.g. 1000$ - 2000$')
    location = models.CharField(max_length=255, blank=True)
    
    deadline = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} at {self.business.name}"


class Application(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('REVIEWING', 'Reviewing'),
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offer = models.ForeignKey(Offer, on_delete=models.CASCADE, related_name='applications')
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='applications')
    
    cover_letter = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('offer', 'applicant')  # Prevent applying twice

    def __str__(self):
        return f"{self.applicant.email} applied for {self.offer.title}"
