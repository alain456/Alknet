from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0027_commerce_order_messages'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionplan',
            name='max_employees',
            field=models.PositiveIntegerField(default=0, help_text="Nombre max d'employés. 0 = illimité."),
        ),
        migrations.AddField(
            model_name='business',
            name='custom_domain',
            field=models.CharField(blank=True, db_index=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='subscriptionpayment',
            name='invoice_number',
            field=models.CharField(blank=True, db_index=True, default='', max_length=40),
        ),
    ]
