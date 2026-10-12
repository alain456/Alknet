from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('site_content', '0010_login_lock_policy'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='hero_slides',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Images du fond du hero d'accueil, gérées par le super admin. Huit maximum.",
            ),
        ),
    ]
