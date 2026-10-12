from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0019_application_access_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollmentapplication',
            name='birth_date',
            field=models.DateField(blank=True, null=True, verbose_name='Date de naissance'),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='gender',
            field=models.CharField(
                blank=True, choices=[('F', 'Féminin'), ('M', 'Masculin')], default='', max_length=1,
            ),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='previous_school',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='École précédente'),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='student_address',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='Adresse'),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='guardian_name',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Parent ou tuteur'),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='guardian_phone',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='guardian_link',
            field=models.CharField(
                blank=True, default='', help_text='Mère, père, tuteur…', max_length=40,
                verbose_name='Lien avec l’élève',
            ),
        ),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='status',
            field=models.CharField(
                choices=[
                    ('BROUILLON', 'Brouillon'),
                    ('ENVOYEE', 'Envoyée'),
                    ('EN_INSTRUCTION', 'En instruction'),
                    ('COMPLEMENT_DEMANDE', 'Complément demandé'),
                    ('LISTE_ATTENTE', 'Liste d’attente'),
                    ('ACCEPTEE', 'Acceptée'),
                    ('REFUSEE', 'Refusée'),
                    ('CONFIRMEE', 'Confirmée'),
                ],
                default='BROUILLON',
                max_length=24,
            ),
        ),
    ]
