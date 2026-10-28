from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0007_document_media'),
    ]

    operations = [
        migrations.AddField(
            model_name='contactrequest',
            name='client_address',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
