from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0016_medicalservice_prestation_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='patient_contact_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Nom complet saisi lors de la prise de rendez-vous',
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='patient_contact_phone',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Téléphone saisi lors de la prise de rendez-vous',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='appointment',
            name='patient_contact_email',
            field=models.EmailField(
                blank=True,
                default='',
                help_text='Email saisi lors de la prise de rendez-vous',
                max_length=254,
            ),
        ),
    ]
