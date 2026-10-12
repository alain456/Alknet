from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0014_public_enrollment_apply'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollmentapplication',
            name='post_year',
            field=models.CharField(
                blank=True, default='', max_length=16, verbose_name='Année post-fondamental',
            ),
        ),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='ecofo_year',
            field=models.CharField(blank=True, default='', max_length=16, verbose_name='Année ECOFO'),
        ),
    ]
