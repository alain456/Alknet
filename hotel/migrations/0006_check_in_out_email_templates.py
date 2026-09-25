from django.db import migrations, models


DEFAULT_CHECK_IN = (
    'Bonjour {guest_name},\n\n'
    'Bienvenue chez {hotel_name} ! Votre check-in est enregistré.\n\n'
    'Référence : {reference}\n'
    'Chambre : {room_number}\n'
    'Arrivée : {check_in}\n'
    'Départ prévu : {check_out}\n'
    "Heure d'enregistrement : {actual_check_in}\n\n"
    'Nous vous souhaitons un excellent séjour.\n\n'
    '— {hotel_name} via Isoko Hub\n'
)

DEFAULT_CHECK_OUT = (
    'Bonjour {guest_name},\n\n'
    'Votre check-out chez {hotel_name} est terminé. Merci de votre séjour.\n\n'
    'Référence : {reference}\n'
    'Chambre : {room_number}\n'
    'Facture : {invoice_number}\n'
    'Total : {invoice_total} {currency}\n'
    'Départ enregistré : {actual_check_out}\n\n'
    'À bientôt !\n\n'
    '— {hotel_name} via Isoko Hub\n'
)


class Migration(migrations.Migration):

    dependencies = [
        ('hotel', '0005_reservation_email_templates'),
    ]

    operations = [
        migrations.AddField(
            model_name='hotelprofile',
            name='check_in_email_message',
            field=models.TextField(
                blank=True,
                default=DEFAULT_CHECK_IN,
                help_text='Email envoyé au client après check-in (réception).',
            ),
        ),
        migrations.AddField(
            model_name='hotelprofile',
            name='check_out_email_message',
            field=models.TextField(
                blank=True,
                default=DEFAULT_CHECK_OUT,
                help_text='Email envoyé au client après check-out (réception).',
            ),
        ),
    ]
