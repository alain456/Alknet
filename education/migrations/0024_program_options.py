from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0023_school_paid_and_free'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationprogram',
            name='options',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Université : options d’un baccalauréat ou d’un master, une par ligne.',
                verbose_name='Options',
            ),
        ),
    ]
