from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wholesale', '0006_wholesaleorder_payer_phone'),
    ]

    operations = [
        migrations.AddField(
            model_name='wholesaleorder',
            name='payment_merchant_account',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='wholesaleorder',
            name='payment_provider_reference',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AlterField(
            model_name='wholesaleorder',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('UNPAID', 'Non payée'),
                    ('AWAITING_PIN', 'En attente PIN Lumicash'),
                    ('PAID', 'Payée'),
                    ('FAILED', 'Échec paiement'),
                    ('REFUNDED', 'Remboursée'),
                ],
                default='UNPAID',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='wholesaleorder',
            name='payment_method',
            field=models.CharField(
                blank=True,
                help_text='Ex: LUMICASH, CASH, FREE',
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name='wholesaleorder',
            name='payer_phone',
            field=models.CharField(
                blank=True,
                help_text='Numéro Lumicash de l\'acheteur (payeur)',
                max_length=40,
            ),
        ),
    ]
