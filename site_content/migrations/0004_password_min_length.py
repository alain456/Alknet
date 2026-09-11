from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("site_content", "0003_platform_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="password_min_length",
            field=models.PositiveSmallIntegerField(
                default=8,
                help_text="Longueur minimale des mots de passe (modifiable par Super Admin)",
            ),
        ),
    ]
