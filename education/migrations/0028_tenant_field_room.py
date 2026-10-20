from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0027_program_study_year_labels'),
    ]

    operations = [
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='student_phone',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='previous_school',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='École précédente'),
        ),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='student_address',
            field=models.CharField(blank=True, default='', max_length=800, verbose_name='Adresse'),
        ),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='guardian_name',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Parent ou tuteur'),
        ),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='guardian_phone',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AlterField(
            model_name='educationfeepayment',
            name='payer_phone',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
    ]
