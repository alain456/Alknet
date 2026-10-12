from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0011_boarding_regime'),
    ]

    operations = [
        migrations.AlterField(
            model_name='educationprofile',
            name='boarding_regime',
            field=models.CharField(
                blank=True,
                choices=[
                    ('INTERNAT', 'Internat — filles et garçons logés'),
                    ('EXTERNE', 'Externe — tout le monde rentre chez soi'),
                    ('MIXTE', 'Mixte — internes et externes'),
                    ('FILLES_INTERNES', 'Internat pour les filles, garçons externes'),
                    ('GARCONS_INTERNES', 'Internat pour les garçons, filles externes'),
                ],
                default='',
                help_text='Internat, externe, mixte, ou internat réservé aux filles ou aux garçons.',
                max_length=32,
                verbose_name='Régime',
            ),
        ),
    ]
