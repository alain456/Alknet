from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0002_commerce_vertical'),
    ]

    operations = [
        migrations.AddField(
            model_name='productvariant',
            name='image_url',
            field=models.TextField(blank=True, default=''),
        ),
    ]
