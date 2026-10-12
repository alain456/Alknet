from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0017_ecofo_classes'),
    ]

    operations = [
        migrations.AddField(
            model_name='admissioncampaign',
            name='extra_criteria',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Ex. test de sélection, entretien. Chaque ligne : kind, label, date, place, details.',
                verbose_name='Critères supplémentaires',
            ),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='criteria_acknowledged',
            field=models.BooleanField(default=False, verbose_name='Critères supplémentaires acceptés'),
        ),
    ]
