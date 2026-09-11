# Generated manually for payer_phone on retail orders

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('retail', '0002_order_payment_tracking'),
    ]

    operations = [
        migrations.AddField(
            model_name='retailorder',
            name='payer_phone',
            field=models.CharField(
                blank=True,
                help_text='Numéro Lumicash du client (paiement privé hors plateforme)',
                max_length=40,
            ),
        ),
    ]
