"""Jeton de possession paiement (commandes grossiste) + rattrapage des AlterField en attente."""
import businesses.payment_access
from django.db import migrations, models


def backfill_payment_tokens(apps, schema_editor):
    """AddField applique un unique défaut à toutes les lignes existantes : on regénère."""
    WholesaleOrder = apps.get_model('wholesale', 'WholesaleOrder')
    pending = [
        (order.pk, businesses.payment_access.issue_payment_token())
        for order in WholesaleOrder.objects.all().only('pk').iterator(chunk_size=500)
    ]
    WholesaleOrder.objects.bulk_update(
        [WholesaleOrder(pk=pk, payment_token=token) for pk, token in pending],
        ['payment_token'],
        batch_size=500,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('wholesale', '0007_order_lumicash_payment'),
    ]

    operations = [
        migrations.AddField(
            model_name='wholesaleorder',
            name='payment_token',
            field=models.CharField(db_index=True, default=businesses.payment_access.issue_payment_token, editable=False, max_length=64),
        ),
        migrations.RunPython(backfill_payment_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='wholesaleorder',
            name='payer_phone',
            field=models.CharField(blank=True, help_text="Numéro BurundiPay de l'acheteur (payeur)", max_length=40),
        ),
        migrations.AlterField(
            model_name='wholesaleorder',
            name='payment_method',
            field=models.CharField(blank=True, help_text='Ex: BURUNDIPAY, CASH, FREE', max_length=40),
        ),
        migrations.AlterField(
            model_name='wholesaleorder',
            name='payment_status',
            field=models.CharField(choices=[('UNPAID', 'Non payée'), ('AWAITING_PIN', 'En attente PIN BurundiPay'), ('PAID', 'Payée'), ('FAILED', 'Échec paiement'), ('REFUNDED', 'Remboursée')], default='UNPAID', max_length=20),
        ),
        migrations.AlterField(
            model_name='wholesalepharmacyprofile',
            name='acceptance_email_message',
            field=models.TextField(blank=True, default='Bonjour,\n\nVotre commande {reference} a été acceptée par {wholesale_name}.\nMontant total : {total_amount} {currency}.\n\nMerci de nous contacter pour la suite de la collaboration.\n\nCordialement,\n{wholesale_name}'),
        ),
    ]
