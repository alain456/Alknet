from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wholesale', '0008_wholesaleorder_payment_token_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='wholesalepharmacyprofile',
            name='submission_email_message',
            field=models.TextField(
                blank=True,
                default=(
                    'Bonjour {client_name},\n\n'
                    'Votre commande {reference} a bien été enregistrée par {wholesale_name}.\n'
                    'Montant total : {total_amount} {currency}.\n\n'
                    'Vous recevrez un e-mail dès que le grossiste aura accepté ou refusé votre commande.\n\n'
                    'Cordialement,\n{wholesale_name}'
                ),
            ),
        ),
        migrations.AddField(
            model_name='wholesalepharmacyprofile',
            name='rejection_email_message',
            field=models.TextField(
                blank=True,
                default=(
                    'Bonjour {client_name},\n\n'
                    'Votre commande {reference} a été refusée par {wholesale_name}.\n'
                    'Motif : {reason}\n\n'
                    'Cordialement,\n{wholesale_name}'
                ),
            ),
        ),
    ]
