# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0027_labresult_appointment'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='consultation_fee_amount',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Montant consultation figé à la réservation (BIF) — source: DoctorProfile.consultation_fee',
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='consultation_fee_currency',
            field=models.CharField(default='BIF', max_length=10),
        ),
        migrations.AddField(
            model_name='appointment',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('UNPAID', 'Non payé'),
                    ('AWAITING_PIN', 'En attente validation PIN'),
                    ('PAID', 'Payé'),
                    ('FAILED', 'Échoué'),
                    ('WAIVED', 'Exonéré'),
                ],
                db_index=True,
                default='UNPAID',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='payment_method',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='appointment',
            name='payer_phone',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='appointment',
            name='payment_provider_reference',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='appointment',
            name='payment_merchant_account',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='appointment',
            name='paid_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='payment_note',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
