# Generated manually for SaaS subscription gate (phase 1)

import uuid
from datetime import timedelta

import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


def seed_plans_and_subscriptions(apps, schema_editor):
    SubscriptionPlan = apps.get_model('businesses', 'SubscriptionPlan')
    BusinessSubscription = apps.get_model('businesses', 'BusinessSubscription')
    Business = apps.get_model('businesses', 'Business')

    trial, _ = SubscriptionPlan.objects.get_or_create(
        code='trial',
        defaults={
            'name': 'Essai gratuit',
            'description': "Période d'essai pour découvrir Isoko Hub.",
            'price_bif': 0,
            'duration_days': 30,
            'is_trial': True,
            'is_active': True,
        },
    )
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

    now = timezone.now()
    ends = now + timedelta(days=30)
    for business in Business.objects.all():
        if BusinessSubscription.objects.filter(business_id=business.id).exists():
            continue
        BusinessSubscription.objects.create(
            id=uuid.uuid4(),
            business=business,
            plan=trial,
            status='TRIAL',
            starts_at=now,
            ends_at=ends,
            payment_reference='',
            notes='Essai migré pour entreprises existantes (phase 1)',
            created_at=now,
        )


def unseed(apps, schema_editor):
    BusinessSubscription = apps.get_model('businesses', 'BusinessSubscription')
    SubscriptionPlan = apps.get_model('businesses', 'SubscriptionPlan')
    BusinessSubscription.objects.all().delete()
    SubscriptionPlan.objects.filter(code__in=['trial', 'monthly', 'yearly']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0014_alter_businessrole_system_access_level'),
    ]

    operations = [
        migrations.CreateModel(
            name='SubscriptionPlan',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.SlugField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True)),
                ('price_bif', models.PositiveIntegerField(default=0, help_text='Prix en BIF (0 = gratuit / essai)')),
                ('duration_days', models.PositiveIntegerField(default=30)),
                ('is_trial', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                'ordering': ['price_bif', 'name'],
            },
        ),
        migrations.CreateModel(
            name='BusinessSubscription',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('TRIAL', 'Essai'), ('ACTIVE', 'Actif'), ('EXPIRED', 'Expiré'), ('SUSPENDED', 'Suspendu'), ('CANCELLED', 'Annulé')], default='TRIAL', max_length=20)),
                ('starts_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('ends_at', models.DateTimeField()),
                ('payment_reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('business', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription', to='businesses.business')),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='subscriptions', to='businesses.subscriptionplan')),
            ],
            options={
                'verbose_name': 'Abonnement entreprise',
                'verbose_name_plural': 'Abonnements entreprises',
                'ordering': ['-ends_at'],
            },
        ),
        migrations.RunPython(seed_plans_and_subscriptions, unseed),
    ]
