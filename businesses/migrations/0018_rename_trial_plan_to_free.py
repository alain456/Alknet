# Generated manually for Free / Mensuel / Annuel catalog

from django.db import migrations


def rename_trial_to_free(apps, schema_editor):
    SubscriptionPlan = apps.get_model('businesses', 'SubscriptionPlan')

    trial = SubscriptionPlan.objects.filter(code='trial').first()
    free = SubscriptionPlan.objects.filter(code='free').first()

    if trial and free:
        # Fusionner : déplacer les FK vers free, supprimer trial
        trial.subscriptions.all().update(plan=free)
        trial.payments.all().update(plan=free)
        if free.duration_days == 30 and trial.duration_days != 30:
            free.duration_days = trial.duration_days
        free.name = 'Free'
        free.description = trial.description or free.description
        free.price_bif = 0
        free.is_trial = True
        free.is_active = True
        free.save()
        trial.delete()
    elif trial and not free:
        trial.code = 'free'
        trial.name = 'Free'
        trial.description = trial.description or "Période gratuite d'accueil pour découvrir Isoko Hub."
        trial.price_bif = 0
        trial.is_trial = True
        trial.is_active = True
        trial.save(update_fields=['code', 'name', 'description', 'price_bif', 'is_trial', 'is_active'])
    elif not free:
        SubscriptionPlan.objects.create(
            code='free',
            name='Free',
            description="Période gratuite d'accueil pour découvrir Isoko Hub.",
            price_bif=0,
            duration_days=30,
            is_trial=True,
            is_active=True,
        )

    # Assurer Mensuel / Annuel
    SubscriptionPlan.objects.get_or_create(
        code='monthly',
        defaults={
            'name': 'Mensuel',
            'description': 'Abonnement mensuel standard.',
            'price_bif': 50000,
            'duration_days': 30,
            'is_trial': False,
            'is_active': True,
        },
    )
    SubscriptionPlan.objects.get_or_create(
        code='yearly',
        defaults={
            'name': 'Annuel',
            'description': 'Abonnement annuel.',
            'price_bif': 500000,
            'duration_days': 365,
            'is_trial': False,
            'is_active': True,
        },
    )


def revert_free_to_trial(apps, schema_editor):
    SubscriptionPlan = apps.get_model('businesses', 'SubscriptionPlan')
    free = SubscriptionPlan.objects.filter(code='free').first()
    if free:
        free.code = 'trial'
        free.name = 'Essai gratuit'
        free.save(update_fields=['code', 'name'])


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0017_platform_notification'),
    ]

    operations = [
        migrations.RunPython(rename_trial_to_free, revert_free_to_trial),
    ]
