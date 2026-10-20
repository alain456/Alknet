from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0026_business_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='commerceprofile',
            name='order_received_message',
            field=models.TextField(
                blank=True,
                default=(
                    'Bonjour {client_name},\n\n'
                    'Votre commande {reference} a bien été enregistrée chez {shop_name}.\n'
                    'Montant : {total_amount} {currency}.\n\n'
                    'Vous recevrez un e-mail dès que la boutique aura accepté ou refusé votre commande.\n\n'
                    'Cordialement,\n{shop_name}'
                ),
            ),
        ),
        migrations.AddField(
            model_name='commerceprofile',
            name='order_accepted_message',
            field=models.TextField(
                blank=True,
                default=(
                    'Bonjour {client_name},\n\n'
                    'Votre commande {reference} a été acceptée par {shop_name}.\n'
                    'Montant : {total_amount} {currency}.\n'
                    'Retrait en magasin.\n\n'
                    'Cordialement,\n{shop_name}'
                ),
            ),
        ),
        migrations.AddField(
            model_name='commerceprofile',
            name='order_refused_message',
            field=models.TextField(
                blank=True,
                default=(
                    'Bonjour {client_name},\n\n'
                    'Votre commande {reference} a été refusée par {shop_name}.\n\n'
                    'Cordialement,\n{shop_name}'
                ),
            ),
        ),
    ]
