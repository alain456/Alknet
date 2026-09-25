from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0031_doctorprofile_office_address'),
    ]

    operations = [
        migrations.AddField(
            model_name='doctorschedule',
            name='schedule_date',
            field=models.DateField(
                blank=True,
                help_text="Date de début du créneau. Sert à calculer le jour et l'instant de fin.",
                null=True,
            ),
        ),
    ]
