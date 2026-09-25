from django.db import migrations, models


DEFAULT_REQUEST = (
    'Bonjour {guest_name},\n\n'
    'Nous avons bien reçu votre demande de réservation chez {hotel_name}.\n\n'
    'Référence : {reference}\n'
    'Arrivée : {check_in}\n'
    'Départ : {check_out}\n'
    'Montant estimé : {amount} {currency}\n'
    'Statut paiement : {payment_status}\n\n'
    "L'établissement confirmera ou refusera votre demande après validation.\n"
    "Vous recevrez un nouvel email dès qu'une décision sera prise.\n\n"
    '— {hotel_name} via Isoko Hub\n'
)

DEFAULT_CONFIRM = (
    'Bonjour {guest_name},\n\n'
    'Bonne nouvelle : votre réservation chez {hotel_name} est confirmée.\n\n'
    'Référence : {reference}\n'
    'Arrivée : {check_in}\n'
    'Départ : {check_out}\n'
    'Type / chambre : {room_type}\n'
    'Montant : {amount} {currency}\n\n'
    "Présentez-vous à la réception le jour d'arrivée avec votre référence.\n\n"
    '— {hotel_name} via Isoko Hub\n'
)

DEFAULT_REJECT = (
    'Bonjour {guest_name},\n\n'
    "Votre demande de réservation chez {hotel_name} n'a pas pu être acceptée.\n\n"
    'Référence : {reference}\n'
    'Arrivée prévue : {check_in}\n'
    'Départ prévu : {check_out}\n'
    'Motif : {reason}\n\n'
    "Vous pouvez effectuer une nouvelle demande ou contacter l'établissement.\n\n"
    '— {hotel_name} via Isoko Hub\n'
)


class Migration(migrations.Migration):

    dependencies = [
        ('hotel', '0004_reservation_payment_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='hotelprofile',
            name='reservation_request_email_message',
            field=models.TextField(
                blank=True,
                default=DEFAULT_REQUEST,
                help_text="Email envoyé à la réception d'une demande de réservation.",
            ),
        ),
        migrations.AddField(
            model_name='hotelprofile',
            name='reservation_confirm_email_message',
            field=models.TextField(
                blank=True,
                default=DEFAULT_CONFIRM,
                help_text="Email envoyé lorsque l'agent confirme la réservation.",
            ),
        ),
        migrations.AddField(
            model_name='hotelprofile',
            name='reservation_reject_email_message',
            field=models.TextField(
                blank=True,
                default=DEFAULT_REJECT,
                help_text="Email envoyé lorsque l'agent refuse / annule la demande.",
            ),
        ),
    ]
