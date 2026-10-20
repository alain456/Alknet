from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('site_content', '0012_support_and_governance'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='business_received_message',
            field=models.TextField(blank=True, default='', help_text="E-mail envoyé à l'entreprise quand son dossier d'inscription arrive."),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='business_approved_message',
            field=models.TextField(blank=True, default='', help_text='E-mail envoyé quand le dossier est approuvé.'),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='business_rejected_message',
            field=models.TextField(blank=True, default='', help_text='E-mail envoyé quand le dossier est refusé.'),
        ),
    ]
