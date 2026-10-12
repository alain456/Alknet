import businesses.payment_access
from django.db import migrations, models


def backfill_hotel_tokens(apps, schema_editor):
    Reservation = apps.get_model('hotel', 'Reservation')
    pending = [
        (row.pk, businesses.payment_access.issue_payment_token())
        for row in Reservation.objects.all().only('pk')
    ]
    if pending:
        Reservation.objects.bulk_update(
            [Reservation(pk=pk, payment_token=token) for pk, token in pending],
            ['payment_token'],
        )


class Migration(migrations.Migration):

    dependencies = [
        ('hotel', '0010_roomtype_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='reservation',
            name='payment_token',
            field=models.CharField(
                db_index=True, default=businesses.payment_access.issue_payment_token,
                editable=False, max_length=64,
            ),
        ),
        migrations.RunPython(backfill_hotel_tokens, migrations.RunPython.noop),
    ]
