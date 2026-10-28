from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0005_service_scale_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='teammember',
            name='photo_url',
            field=models.TextField(blank=True, default=''),
        ),
    ]
