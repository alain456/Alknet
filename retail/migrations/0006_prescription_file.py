# Generated manually for Prescription.file upload

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('retail', '0005_retailpharmacyprofile_is_open_for_orders'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='file',
            field=models.FileField(
                blank=True,
                help_text='Fichier ordonnance (image ou PDF)',
                null=True,
                upload_to='retail/prescriptions/%Y/%m/',
            ),
        ),
        migrations.AlterField(
            model_name='prescription',
            name='file_url',
            field=models.TextField(
                blank=True,
                default='',
                help_text='URL d’accès (média ou legacy data-URI / URL externe)',
            ),
        ),
    ]
