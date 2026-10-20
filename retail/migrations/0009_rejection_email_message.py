from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('retail', '0008_retailorder_payment_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='retailpharmacyprofile',
            name='rejection_email_message',
            field=models.TextField(
                blank=True,
                default=(
                    'Bonjour {patient_name},\n\n'
                    'Votre commande {reference} a été refusée par {pharmacy_name}.\n'
                    'Motif : {reason}\n\n'
                    'Cordialement,\n{pharmacy_name}'
                ),
            ),
        ),
    ]
