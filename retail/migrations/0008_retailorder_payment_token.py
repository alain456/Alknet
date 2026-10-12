"""Jeton de possession paiement pour les commandes de pharmacie de détail."""
import businesses.payment_access
from django.db import migrations, models


def backfill_payment_tokens(apps, schema_editor):
    """AddField applique un unique défaut à toutes les lignes existantes : on regénère."""
    RetailOrder = apps.get_model('retail', 'RetailOrder')
    pending = [
        (order.pk, businesses.payment_access.issue_payment_token())
        for order in RetailOrder.objects.all().only('pk').iterator(chunk_size=500)
    ]
    RetailOrder.objects.bulk_update(
        [RetailOrder(pk=pk, payment_token=token) for pk, token in pending],
        ['payment_token'],
        batch_size=500,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('retail', '0007_retailpharmacyprofile_submission_email_message_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='retailorder',
            name='payment_token',
            field=models.CharField(db_index=True, default=businesses.payment_access.issue_payment_token, editable=False, max_length=64),
        ),
        migrations.RunPython(backfill_payment_tokens, migrations.RunPython.noop),
    ]
