from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0033_campaign_year_dates'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationprogram',
            name='tuition',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Année académique et tranches (montant et date) pour ce programme.',
                verbose_name='Frais de scolarité',
            ),
        ),
    ]
