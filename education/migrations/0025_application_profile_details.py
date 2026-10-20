from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0024_program_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollmentapplication',
            name='profile_details',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Université : identité, études antérieures, contact et niveau (BAC I, II, III).',
                verbose_name='Détail du candidat',
            ),
        ),
    ]
