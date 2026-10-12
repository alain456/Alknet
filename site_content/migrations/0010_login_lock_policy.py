from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("site_content", "0009_contactmessage_reply"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="login_max_failures",
            field=models.PositiveSmallIntegerField(
                default=5,
                help_text="Nombre d'échecs de connexion avant blocage du compte",
            ),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="login_lock_minutes",
            field=models.PositiveIntegerField(
                default=15,
                help_text="Durée du blocage du compte, en minutes",
            ),
        ),
    ]
