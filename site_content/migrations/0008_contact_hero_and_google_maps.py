from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('site_content', '0007_contact_page_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='contact_hero_image',
            field=models.TextField(
                blank=True,
                default='',
                help_text='URL ou image base64 du hero Contact Us.',
            ),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='contact_google_maps_url',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Lien Google Maps (partage ou embed) pour la carte Contact Us.',
            ),
        ),
    ]
