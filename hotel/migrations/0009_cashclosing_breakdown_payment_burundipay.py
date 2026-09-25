# Generated for cash closing breakdown + payment choices (no DB constraint change needed for choices)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hotel', '0008_reservation_departure_reminder'),
    ]

    operations = [
        migrations.AddField(
            model_name='cashclosing',
            name='breakdown',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Répartition par méthode + compteurs au moment de la clôture',
            ),
        ),
        migrations.AlterField(
            model_name='payment',
            name='method',
            field=models.CharField(
                choices=[
                    ('CASH', 'Espèces'),
                    ('TRANSFER', 'Virement'),
                    ('CARD', 'Carte'),
                    ('MOBILE_MONEY', 'Mobile money'),
                    ('BURUNDIPAY', 'BurundiPay'),
                    ('OTHER', 'Autre'),
                ],
                default='CASH',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='payment',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'En attente'),
                    ('AWAITING_PIN', 'En attente PIN'),
                    ('PARTIAL', 'Partiel'),
                    ('PAID', 'Payé'),
                    ('FAILED', 'Échoué'),
                    ('REFUNDED', 'Remboursé'),
                    ('CANCELLED', 'Annulé'),
                ],
                default='PAID',
                max_length=20,
            ),
        ),
    ]
