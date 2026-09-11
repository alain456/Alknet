# Generated manually for appointment reference prefix

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0019_appointment_professional_workflow'),
    ]

    operations = [
        migrations.AddField(
            model_name='hospitalprofile',
            name='appointment_reference_prefix',
            field=models.CharField(
                blank=True,
                default='RDV',
                help_text='Préfixe des numéros de suivi (ex: RDV → RDV-BAHO-2026-000128)',
                max_length=15,
            ),
        ),
        migrations.AlterField(
            model_name='hospitalprofile',
            name='acronym',
            field=models.CharField(
                blank=True,
                help_text="Sigle de l'établissement (ex: BAHO, CHU, CHUK) — utilisé dans les références RDV",
                max_length=20,
                null=True,
            ),
        ),
    ]
