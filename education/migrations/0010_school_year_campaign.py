from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0009_preschool_track'),
    ]

    operations = [
        migrations.AlterField(
            model_name='admissioncampaign',
            name='program',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='campaigns',
                to='education.educationprogram',
            ),
        ),
        migrations.AddConstraint(
            model_name='admissioncampaign',
            constraint=models.UniqueConstraint(
                condition=models.Q(program__isnull=True),
                fields=('business', 'academic_year'),
                name='uniq_education_school_year',
            ),
        ),
    ]
