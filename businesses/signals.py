from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Business
from .subscription import ensure_business_subscription


@receiver(post_save, sender=Business)
def create_trial_subscription(sender, instance, created, **kwargs):
    """À la création d'une entreprise : période Free (durée = plan free.duration_days)."""
    if created:
        ensure_business_subscription(instance)
