from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0021_doctorprofile_is_public_directory'),
    ]

    operations = [
        migrations.AddField(
            model_name='hospitalprofile',
            name='appointment_request_ack_message',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Message email envoyé au patient après sa demande de RDV (variables : {patient_name}, {reference}, …)',
            ),
        ),
        migrations.AddField(
            model_name='hospitalprofile',
            name='appointment_confirmation_default_message',
            field=models.TextField(
                blank=True,
                default='',
                help_text="Modèle par défaut pour l'email de confirmation admin (mêmes variables)",
            ),
        ),
    ]
