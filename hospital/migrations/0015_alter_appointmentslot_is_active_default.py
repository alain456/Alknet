# Generated migration — créneaux non publiés par défaut
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0014_servicecategory'),
    ]

    operations = [
        migrations.AlterField(
            model_name='appointmentslot',
            name='is_active',
            field=models.BooleanField(
                default=False,
                help_text="Publier le créneau côté patient (activé par l'admin)",
            ),
        ),
    ]
