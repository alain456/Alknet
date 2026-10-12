from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0015_post_year_and_ecofo_years'),
    ]

    operations = [
        migrations.AddField(
            model_name='admissioncampaign',
            name='enrollment_plan',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Années ouvertes et nombre de places par parcours / section.',
                verbose_name='Plan d’inscription',
            ),
        ),
    ]
