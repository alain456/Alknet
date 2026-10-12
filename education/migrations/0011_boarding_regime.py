from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0010_school_year_campaign'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationprofile',
            name='boarding_regime',
            field=models.CharField(
                blank=True,
                choices=[
                    ('INTERNAT', 'Internat'),
                    ('EXTERNE', 'Externe'),
                    ('MIXTE', 'Mixte'),
                ],
                default='',
                help_text='Internat : logés à l’école. Externe : rentrent chez eux. Mixte : les deux.',
                max_length=16,
                verbose_name='Régime',
            ),
        ),
    ]
