import secrets

from django.db import migrations, models


def fill_access_tokens(apps, schema_editor):
    Application = apps.get_model('education', 'EnrollmentApplication')
    for row in Application.objects.filter(access_token=''):
        row.access_token = secrets.token_urlsafe(32)
        row.save(update_fields=['access_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0018_extra_criteria'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollmentapplication',
            name='access_token',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.RunPython(fill_access_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='enrollmentapplication',
            name='access_token',
            field=models.CharField(default=secrets.token_urlsafe, editable=False, max_length=64, unique=True),
        ),
    ]
