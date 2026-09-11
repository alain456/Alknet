from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("site_content", "0002_platform_logo_services_page"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="platform_fee_percent",
            field=models.DecimalField(decimal_places=2, default=10, help_text="Commission plateforme (%)", max_digits=5),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="tax_rate_percent",
            field=models.DecimalField(decimal_places=2, default=18, help_text="Taux TVA par défaut (%)", max_digits=5),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="currency",
            field=models.CharField(default="BIF", max_length=10),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="auto_approve_businesses",
            field=models.BooleanField(default=False, help_text="Approuver automatiquement les nouvelles entreprises"),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="maintenance_mode",
            field=models.BooleanField(default=False, help_text="Mode maintenance — seuls les Super Admin se connectent"),
        ),
    ]
