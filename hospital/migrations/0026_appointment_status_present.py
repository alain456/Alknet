from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0025_hospital_exam'),
    ]

    operations = [
        migrations.AlterField(
            model_name='appointment',
            name='status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Brouillon'),
                    ('REQUEST_SENT', 'Demande envoyée'),
                    ('PENDING', 'En attente de confirmation'),
                    ('CONFIRMED', 'Confirmé'),
                    ('PATIENT_ARRIVED', 'Patient arrivé'),
                    ('WAITING_ROOM', "En salle d'attente"),
                    ('PRESENT', 'Présent'),
                    ('IN_PROGRESS', 'En consultation'),
                    ('COMPLETED', 'Terminé'),
                    ('REJECTED', 'Refusé'),
                    ('CANCELLED', 'Annulé'),
                    ('RESCHEDULED', 'Reprogrammé'),
                    ('NO_SHOW', 'Patient absent'),
                ],
                default='PENDING',
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
                    ('NOTIFICATION_SENT', 'Notification envoyée'),
                    ('STATUS_CHANGED', 'Changement de statut'),
                ],
                max_length=30,
            ),
        ),
    ]
