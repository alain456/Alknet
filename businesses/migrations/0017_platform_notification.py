# Generated manually — notifications Super Admin paiements SaaS

import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0016_subscription_payment'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlatformNotification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('notification_type', models.CharField(choices=[('SUBSCRIPTION_PAID', 'Abonnement payé'), ('SUBSCRIPTION_FAILED', 'Échec paiement abo'), ('INFO', 'Information')], default='INFO', max_length=40)),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('details', models.JSONField(blank=True, default=dict)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='platform_notifications', to='businesses.business')),
                ('payment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='platform_notifications', to='businesses.subscriptionpayment')),
            ],
            options={
                'verbose_name': 'Notification plateforme',
                'verbose_name_plural': 'Notifications plateforme',
                'ordering': ['-created_at'],
            },
        ),
    ]
