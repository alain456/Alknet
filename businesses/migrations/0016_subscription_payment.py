# Generated manually — paiements abonnement Lumicash (SaaS)

import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('businesses', '0015_subscription_plans'),
    ]

    operations = [
        migrations.CreateModel(
            name='SubscriptionPayment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount_bif', models.PositiveIntegerField()),
                ('currency', models.CharField(default='BIF', max_length=10)),
                ('payer_phone', models.CharField(help_text='Numéro Lumicash du payeur (entreprise)', max_length=40)),
                ('status', models.CharField(choices=[('PENDING', 'En attente'), ('AWAITING_PIN', 'En attente validation PIN'), ('SUCCESS', 'Réussi'), ('FAILED', 'Échoué'), ('CANCELLED', 'Annulé'), ('EXPIRED', 'Expiré')], default='PENDING', max_length=20)),
                ('provider', models.CharField(default='LUMICASH', max_length=40)),
                ('provider_reference', models.CharField(blank=True, db_index=True, max_length=120)),
                ('merchant_account', models.CharField(blank=True, help_text='Compte marchand plateforme Isoko Hub', max_length=80)),
                ('raw_request', models.JSONField(blank=True, default=dict)),
                ('raw_response', models.JSONField(blank=True, default=dict)),
                ('error_message', models.TextField(blank=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('business', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subscription_payments', to='businesses.business')),
                ('initiated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subscription_payments_initiated', to=settings.AUTH_USER_MODEL)),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='payments', to='businesses.subscriptionplan')),
                ('subscription', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payments', to='businesses.businesssubscription')),
            ],
            options={
                'verbose_name': 'Paiement abonnement SaaS',
                'verbose_name_plural': 'Paiements abonnements SaaS',
                'ordering': ['-created_at'],
            },
        ),
    ]
