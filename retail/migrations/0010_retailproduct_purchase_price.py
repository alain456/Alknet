from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('retail', '0009_rejection_email_message'),
    ]

    operations = [
        migrations.AddField(
            model_name='retailproduct',
            name='purchase_price',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14),
        ),
    ]
