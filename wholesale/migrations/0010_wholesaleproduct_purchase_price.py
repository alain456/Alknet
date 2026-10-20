from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wholesale', '0009_order_email_messages'),
    ]

    operations = [
        migrations.AddField(
            model_name='wholesaleproduct',
            name='purchase_price',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14),
        ),
    ]
