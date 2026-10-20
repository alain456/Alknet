from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0032_education_query_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='admissioncampaign',
            name='year_start',
            field=models.DateField(blank=True, null=True, verbose_name='Rentrée'),
        ),
        migrations.AddField(
            model_name='admissioncampaign',
            name='year_break_start',
            field=models.DateField(blank=True, null=True, verbose_name='Début de pause'),
        ),
        migrations.AddField(
            model_name='admissioncampaign',
            name='year_break_end',
            field=models.DateField(blank=True, null=True, verbose_name='Fin de pause'),
        ),
        migrations.AddField(
            model_name='admissioncampaign',
            name='year_exam_start',
            field=models.DateField(blank=True, null=True, verbose_name='Début des examens'),
        ),
        migrations.AddField(
            model_name='admissioncampaign',
            name='year_deliberation',
            field=models.DateField(blank=True, null=True, verbose_name='Délibération'),
        ),
    ]
