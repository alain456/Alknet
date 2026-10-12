import uuid

import businesses.payment_access
from django.db import migrations, models
import django.db.models.deletion


def backfill_hospital_tokens(apps, schema_editor):
    Appointment = apps.get_model('hospital', 'Appointment')
    pending = [
        (row.pk, businesses.payment_access.issue_payment_token())
        for row in Appointment.objects.all().only('pk')
    ]
    if pending:
        Appointment.objects.bulk_update(
            [Appointment(pk=pk, payment_token=token) for pk, token in pending],
            ['payment_token'],
        )


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0036_auto_invoice_paid_appointments'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='payment_token',
            field=models.CharField(
                db_index=True, default=businesses.payment_access.issue_payment_token,
                editable=False, max_length=64,
            ),
        ),
        migrations.RunPython(backfill_hospital_tokens, migrations.RunPython.noop),
    ]
