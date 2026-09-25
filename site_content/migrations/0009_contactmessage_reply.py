# Generated manually for ContactMessage reply tracking

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('site_content', '0008_contact_hero_and_google_maps'),
    ]

    operations = [
        migrations.AddField(
            model_name='contactmessage',
            name='reply_body',
            field=models.TextField(blank=True, help_text='Dernière réponse envoyée au client'),
        ),
        migrations.AddField(
            model_name='contactmessage',
            name='replied_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='contactmessage',
            name='replied_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='contact_replies',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterModelOptions(
            name='contactmessage',
            options={
                'ordering': ['-created_at'],
                'verbose_name': 'Message de contact',
                'verbose_name_plural': 'Messages de contact',
            },
        ),
    ]
