from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0015_alter_appointmentslot_is_active_default'),
    ]

    operations = [
        migrations.AddField(
            model_name='medicalservice',
            name='prestation_category',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='medical_services',
                to='hospital.servicecategory',
                help_text="Catégorie personnalisée créée par l'hôpital",
            ),
        ),
    ]
