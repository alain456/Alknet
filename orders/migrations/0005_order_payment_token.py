"""Jeton de possession paiement (parcours invité) + rattrapage des AlterField en attente."""
import businesses.payment_access
from django.db import migrations, models


def backfill_payment_tokens(apps, schema_editor):
    """AddField applique un unique défaut à toutes les lignes existantes : on regénère."""
    Order = apps.get_model('orders', 'Order')
    pending = [
        (order.pk, businesses.payment_access.issue_payment_token())
        for order in Order.objects.all().only('pk').iterator(chunk_size=500)
    ]
    Order.objects.bulk_update(
        [Order(pk=pk, payment_token=token) for pk, token in pending],
        ['payment_token'],
        batch_size=500,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_cash_collection'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='payment_token',
            field=models.CharField(db_index=True, default=businesses.payment_access.issue_payment_token, editable=False, max_length=64),
        ),
        migrations.RunPython(backfill_payment_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='order',
            name='payment_status',
            field=models.CharField(choices=[('UNPAID', 'Non payée'), ('AWAITING_PIN', 'En attente PIN BurundiPay'), ('PAID', 'Payée'), ('FAILED', 'Échec paiement'), ('REFUNDED', 'Remboursée')], default='UNPAID', max_length=20),
        ),
    ]
