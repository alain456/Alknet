from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hotel', '0006_check_in_out_email_templates'),
    ]

    operations = [
        migrations.AddField(
            model_name='reservation',
            name='decision_note',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Message de confirmation ou de refus visible par le client',
            ),
        ),
        migrations.AddField(
            model_name='reservation',
            name='decision_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reschedule_status',
            field=models.CharField(
                choices=[
                    ('NONE', 'Aucune'),
                    ('PENDING', 'En attente'),
                    ('ACCEPTED', 'Acceptée'),
                    ('REFUSED', 'Refusée'),
                ],
                db_index=True,
                default='NONE',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reschedule_preferred_check_in',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reschedule_preferred_check_out',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reschedule_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reschedule_admin_note',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reschedule_requested_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='reservation',
            name='reschedule_resolved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
