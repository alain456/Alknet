from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0030_appointment_anticipation_request'),
    ]

    operations = [
        migrations.AddField(
            model_name='doctorprofile',
            name='office_address',
            field=models.CharField(
                blank=True,
                help_text='Bureau / cabinet du médecin (salle, étage, bâtiment…) visible lors des RDV',
                max_length=300,
                null=True,
            ),
        ),
    ]
