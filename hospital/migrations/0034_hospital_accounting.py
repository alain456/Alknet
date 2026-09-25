from django.conf import settings
from django.db import migrations, models
import django.utils.timezone
import uuid


def backfill_invoice_numbers(apps, schema_editor):
    Invoice = apps.get_model('hospital', 'Invoice')
    counters = {}
    for inv in Invoice.objects.order_by('issued_at').iterator():
        if inv.invoice_number:
            continue
        key = inv.hospital_id
        counters[key] = counters.get(key, 0) + 1
        year = inv.issued_at.year if inv.issued_at else 2026
        hospital_key = str(inv.hospital_id).replace('-', '')[:6].upper()
        inv.invoice_number = f'FAC-{hospital_key}-{year}-{counters[key]:05d}'
        if inv.status == 'PAID' and not inv.payment_method:
            inv.payment_method = 'CASH'
        inv.save(update_fields=['invoice_number', 'payment_method'])


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0033_doctorprofile_accountant'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='act_label',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='invoice',
            name='act_type',
            field=models.CharField(
                choices=[
                    ('CONSULTATION', 'Consultation'),
                    ('EXAM', 'Examen'),
                    ('OTHER', 'Autre prestation'),
                ],
                default='OTHER',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='currency',
            field=models.CharField(default='BIF', max_length=10),
        ),
        migrations.AddField(
            model_name='invoice',
            name='invoice_number',
            field=models.CharField(blank=True, db_index=True, max_length=40, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='payment_method',
            field=models.CharField(
                blank=True,
                choices=[
                    ('', '—'),
                    ('CASH', 'Espèces'),
                    ('BURUNDIPAY', 'BurundiPay'),
                    ('FREE', 'Gratuit'),
                    ('OTHER', 'Autre'),
                ],
                default='',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='recorded_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='recorded_invoices',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='HospitalCashClosing',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('period_date', models.DateField()),
                ('total_collected', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_pending', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('breakdown', models.JSONField(blank=True, default=dict)),
                ('notes', models.TextField(blank=True, default='')),
                ('closed_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('closed_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='hospital_cash_closings', to=settings.AUTH_USER_MODEL)),
                ('hospital', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='hospital_cash_closings', to='businesses.business')),
            ],
            options={
                'ordering': ['-period_date'],
                'unique_together': {('hospital', 'period_date')},
            },
        ),
        migrations.RunPython(backfill_invoice_numbers, migrations.RunPython.noop),
    ]
