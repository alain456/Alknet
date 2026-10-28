from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0003_provider_module'),
    ]

    operations = [
        migrations.AddField(
            model_name='service',
            name='parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='grouped_services',
                to='services.service',
            ),
        ),
    ]
