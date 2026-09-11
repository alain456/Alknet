# Generated manually for payer_phone on wholesale orders

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wholesale', '0005_order_payment_tracking'),
    ]

    operations = [
        migrations.AddField(
            model_name='wholesaleorder',
            name='payer_phone',
            field=models.CharField(
                blank=True,
                help_text='Numéro Lumicash de l\'acheteur (paiement privé hors plateforme)',
                max_length=40,
            ),
        ),
    ]
