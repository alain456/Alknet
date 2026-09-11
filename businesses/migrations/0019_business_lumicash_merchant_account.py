# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0018_rename_trial_plan_to_free'),
    ]

    operations = [
        migrations.AddField(
            model_name='business',
            name='lumicash_merchant_account',
            field=models.CharField(
                blank=True,
                help_text="Compte marchand Lumicash de l'établissement (encaissement consultations / RDV)",
                max_length=80,
            ),
        ),
    ]
