from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0026_university_paid_and_free'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationprogram',
            name='study_year_labels',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Libellés des années du cycle. Vide : proposés selon le cycle et la durée.',
                verbose_name='Niveaux d’inscription',
            ),
        ),
    ]
