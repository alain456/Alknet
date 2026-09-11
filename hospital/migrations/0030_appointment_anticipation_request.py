from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0029_appointment_payment_refunded'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='anticipation_admin_note',
            field=models.TextField(blank=True, default='', help_text="Réponse / note de l'administration"),
        ),
        migrations.AddField(
            model_name='appointment',
            name='anticipation_preferred_at',
            field=models.DateTimeField(blank=True, help_text='Date/heure souhaitée plus tôt par le patient', null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='anticipation_reason',
            field=models.TextField(blank=True, default='', help_text="Motif de la demande d'anticipation"),
        ),
        migrations.AddField(
            model_name='appointment',
            name='anticipation_requested_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='anticipation_resolved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='anticipation_status',
            field=models.CharField(
                choices=[
                    ('NONE', 'Aucune'),
                    ('PENDING', 'En attente de réponse'),
                    ('ACCEPTED', 'Acceptée'),
                    ('REFUSED', 'Refusée'),
                ],
                db_index=True,
                default='NONE',
                help_text='Demande patient pour avancer le rendez-vous',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='appointmentevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('CREATED', 'Demande créée'),
                    ('CONFIRMED', 'Rendez-vous confirmé'),
                    ('REJECTED', 'Demande refusée'),
                    ('CHECK_IN', 'Patient arrivé'),
                    ('WAITING_ROOM', "En salle d'attente"),
                    ('STARTED', 'Patient marqué présent / consultation démarrée'),
                    ('PRESENT', 'Patient présent'),
                    ('COMPLETED', 'Rendez-vous terminé'),
                    ('CANCELLED', 'Rendez-vous annulé'),
                    ('RESCHEDULED', 'Créneau reprogrammé'),
                    ('NO_SHOW', 'Patient absent'),
                    ('ANTICIPATION_REQUESTED', "Demande d'anticipation"),
                    ('ANTICIPATION_ACCEPTED', 'Anticipation acceptée'),
                    ('ANTICIPATION_REFUSED', 'Anticipation refusée'),
                    ('NOTIFICATION_SENT', 'Notification envoyée'),
                    ('STATUS_CHANGED', 'Changement de statut'),
                ],
                max_length=30,
            ),
        ),
    ]
