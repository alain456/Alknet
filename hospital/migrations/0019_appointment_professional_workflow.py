from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('hospital', '0018_appointment_reference_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='appointment_category',
            field=models.CharField(
                choices=[
                    ('GENERAL', 'Consultation générale'),
                    ('SPECIALIZED', 'Consultation spécialisée'),
                    ('FOLLOW_UP', 'Contrôle / suivi'),
                    ('EMERGENCY', 'Urgence'),
                    ('EXAM', 'Examen'),
                ],
                default='GENERAL',
                help_text='Type de consultation (motif métier)',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='checked_in_at',
            field=models.DateTimeField(blank=True, help_text="Date d'arrivée du patient à l'accueil", null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='confirmed_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Agent ou admin ayant confirmé le rendez-vous',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='confirmed_appointments',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Utilisateur ayant créé la demande',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_appointments',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='duration_minutes',
            field=models.PositiveIntegerField(default=30, help_text='Durée prévue de la consultation en minutes'),
        ),
        migrations.AddField(
            model_name='appointment',
            name='reschedule_reason',
            field=models.TextField(blank=True, help_text='Motif de reprogrammation', null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='service',
            field=models.ForeignKey(
                blank=True,
                help_text='Service médical associé au rendez-vous',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='appointments',
                to='hospital.medicalservice',
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='source',
            field=models.CharField(
                choices=[
                    ('APPLICATION_PATIENT', 'Application patient'),
                    ('RECEPTION', "Agent d'accueil"),
                    ('ADMINISTRATION', 'Administration'),
                ],
                default='APPLICATION_PATIENT',
                help_text='Origine de la demande de rendez-vous',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='started_at',
            field=models.DateTimeField(blank=True, help_text='Date de début de la consultation', null=True),
        ),
        migrations.AlterField(
            model_name='appointment',
            name='cancellation_reason',
            field=models.TextField(blank=True, help_text="Motif d'annulation ou de refus", null=True),
        ),
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
        migrations.CreateModel(
            name='AppointmentEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event_type', models.CharField(choices=[
                    ('CREATED', 'Demande créée'),
                    ('CONFIRMED', 'Rendez-vous confirmé'),
                    ('REJECTED', 'Demande refusée'),
                    ('CHECK_IN', 'Patient arrivé'),
                    ('WAITING_ROOM', "En salle d'attente"),
                    ('STARTED', 'Consultation démarrée'),
                    ('COMPLETED', 'Rendez-vous terminé'),
                    ('CANCELLED', 'Rendez-vous annulé'),
                    ('RESCHEDULED', 'Créneau reprogrammé'),
                    ('NO_SHOW', 'Patient absent'),
                    ('NOTIFICATION_SENT', 'Notification envoyée'),
                    ('STATUS_CHANGED', 'Changement de statut'),
                ], max_length=30)),
                ('previous_status', models.CharField(blank=True, default='', max_length=20)),
                ('new_status', models.CharField(blank=True, default='', max_length=20)),
                ('comment', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='appointment_events', to=settings.AUTH_USER_MODEL)),
                ('appointment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='hospital.appointment')),
            ],
            options={'ordering': ['created_at']},
        ),
        migrations.CreateModel(
            name='AppointmentNotificationLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('channel', models.CharField(choices=[('INTERNAL', 'Notification interne'), ('EMAIL', 'Email'), ('SMS', 'SMS')], default='INTERNAL', max_length=20)),
                ('notification_type', models.CharField(max_length=50)),
                ('destination', models.CharField(blank=True, default='', max_length=255)),
                ('status', models.CharField(choices=[('PENDING', 'En attente'), ('SENT', 'Envoyé'), ('FAILED', 'Échec')], default='SENT', max_length=20)),
                ('error_message', models.TextField(blank=True, default='')),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('appointment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notification_logs', to='hospital.appointment')),
                ('recipient', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='appointment_notification_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-sent_at']},
        ),
        migrations.AddIndex(
            model_name='appointmentevent',
            index=models.Index(fields=['appointment', 'created_at'], name='idx_appt_event_time'),
        ),
    ]
