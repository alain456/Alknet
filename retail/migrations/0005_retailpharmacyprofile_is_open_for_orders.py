from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('retail', '0004_order_lumicash_payment'),
    ]

    operations = [
        migrations.AddField(
            model_name='retailpharmacyprofile',
            name='is_open_for_orders',
            field=models.BooleanField(
                default=True,
                help_text='Si False, les nouvelles commandes patients sont bloquées.',
            ),
        ),
    ]
