from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('site_content', '0011_hero_slides'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='maintenance_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='processing_register',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='contactmessage',
            name='ticket_status',
            field=models.CharField(
                choices=[
                    ('OPEN', 'Ouvert'),
                    ('IN_PROGRESS', 'En cours'),
                    ('WAITING', 'En attente du client'),
                    ('RESOLVED', 'Résolu'),
                ],
                default='OPEN',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='contactmessage',
            name='priority',
            field=models.CharField(
                choices=[
                    ('LOW', 'Basse'),
                    ('NORMAL', 'Normale'),
                    ('URGENT', 'Urgente'),
                ],
                default='NORMAL',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='contactmessage',
            name='assigned_to',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='assigned_contact_tickets',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
