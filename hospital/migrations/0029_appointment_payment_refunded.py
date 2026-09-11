# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0028_appointment_consultation_payment'),
    ]

    operations = [
        migrations.AlterField(
            model_name='appointment',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('UNPAID', 'Non payé'),
                    ('AWAITING_PIN', 'En attente validation PIN'),
                    ('PAID', 'Payé'),
                    ('FAILED', 'Échoué'),
                    ('WAIVED', 'Exonéré'),
                    ('REFUNDED', 'Remboursé'),
                ],
                db_index=True,
                default='UNPAID',
                max_length=20,
            ),
        ),
    ]
