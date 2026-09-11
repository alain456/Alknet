from django.db import migrations, models


def backfill_reference_codes(apps, schema_editor):
    Appointment = apps.get_model('hospital', 'Appointment')
    for appt in Appointment.objects.all().order_by('created_at'):
        year = appt.created_at.year if appt.created_at else 2026
        count = Appointment.objects.filter(
            hospital_id=appt.hospital_id,
        ).exclude(reference_code='').count()
        appt.reference_code = f'RDV-{year}-{count + 1:05d}'
        appt.save(update_fields=['reference_code'])


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0017_appointment_patient_contact_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='reference_code',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Numéro de suivi patient (ex: RDV-2026-00042)',
                max_length=30,
            ),
        ),
        migrations.RunPython(backfill_reference_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='appointment',
            name='reference_code',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Numéro de suivi patient (ex: RDV-2026-00042)',
                max_length=30,
                unique=True,
            ),
        ),
    ]
