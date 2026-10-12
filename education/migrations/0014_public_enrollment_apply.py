import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('education', '0013_school_track_enrollment'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollmentapplication',
            name='student_name',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='student_email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='student_phone',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='applicant',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='education_applications',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RemoveConstraint(
            model_name='enrollmentapplication',
            name='uniq_education_application_per_campaign',
        ),
        migrations.AddConstraint(
            model_name='enrollmentapplication',
            constraint=models.UniqueConstraint(
                condition=models.Q(('applicant__isnull', False)),
                fields=('campaign', 'applicant'),
                name='uniq_education_application_per_campaign',
            ),
        ),
        migrations.AddConstraint(
            model_name='enrollmentapplication',
            constraint=models.UniqueConstraint(
                condition=~models.Q(('student_email', '')),
                fields=('campaign', 'student_email'),
                name='uniq_education_application_per_email',
            ),
        ),
        migrations.AddField(
            model_name='educationfeepayment',
            name='application',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='fee_payments',
                to='education.enrollmentapplication',
            ),
        ),
        migrations.AlterField(
            model_name='educationfeepayment',
            name='applicant',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='education_fee_payments',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
