# Generated manually for LabResult.appointment eligibility gate

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0026_appointment_status_present'),
    ]

    operations = [
        migrations.AddField(
            model_name='labresult',
            name='appointment',
            field=models.ForeignKey(
                blank=True,
                help_text='RDV associé — le patient doit être Présent (après confirmation et arrivée)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='lab_results',
                to='hospital.appointment',
            ),
        ),
    ]
