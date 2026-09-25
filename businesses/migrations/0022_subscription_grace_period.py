from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0021_commerce_compliance_docs'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlatformSubscriptionSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('grace_period_days', models.PositiveIntegerField(default=7, help_text="Jours d'accès après l'échéance, pour toutes les entreprises")),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Réglage abonnement plateforme',
                'verbose_name_plural': 'Réglages abonnement plateforme',
            },
        ),
        migrations.AddField(
            model_name='businesssubscription',
            name='expiry_warning_ends_at',
            field=models.DateTimeField(blank=True, help_text="Échéance pour laquelle l'alerte des 5 jours a déjà été envoyée", null=True),
        ),
        migrations.AddField(
            model_name='businesssubscription',
            name='grace_notice_ends_at',
            field=models.DateTimeField(blank=True, help_text="Échéance pour laquelle le début de grâce a déjà été signalé", null=True),
        ),
        migrations.AlterField(
            model_name='businesssubscription',
            name='status',
            field=models.CharField(
                choices=[
                    ('TRIAL', 'Free'),
                    ('ACTIVE', 'Actif'),
                    ('GRACE', 'Période de grâce'),
                    ('EXPIRED', 'Expiré'),
                    ('SUSPENDED', 'Suspendu'),
                    ('CANCELLED', 'Annulé'),
                ],
                default='TRIAL',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='platformnotification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('SUBSCRIPTION_PAID', 'Abonnement payé'),
                    ('SUBSCRIPTION_FAILED', 'Échec paiement abo'),
                    ('SUBSCRIPTION_EXPIRING', 'Abonnement bientôt expiré'),
                    ('SUBSCRIPTION_GRACE', 'Période de grâce'),
                    ('INFO', 'Information'),
                ],
                default='INFO',
                max_length=40,
            ),
        ),
    ]
