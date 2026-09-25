# Generated manually for departure reminders (J-1)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hotel', '0007_reservation_reschedule_decision'),
    ]

    operations = [
        migrations.AddField(
            model_name='reservation',
            name='departure_reminder_sent_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Date d’envoi de l’alerte « séjour se termine demain »',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='reservation',
            name='departure_reminder_note',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Message visible par le client sur l’historique (rappel de départ)',
            ),
        ),
    ]
