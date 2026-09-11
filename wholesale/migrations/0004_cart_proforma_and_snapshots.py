import uuid
from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0014_alter_businessrole_system_access_level'),
        ('wholesale', '0003_therapeutic_class'),
    ]

    operations = [
        migrations.AlterField(
            model_name='wholesaleorder',
            name='buyer_type',
            field=models.CharField(
                choices=[('PERSON', 'Personne'), ('RETAIL_PHARMACY', 'Pharmacie de detail')],
                default='RETAIL_PHARMACY',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='wholesalecartitem',
            name='packaging_snapshot',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='wholesalecartitem',
            name='product_name_snapshot',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='wholesalecartitem',
            name='unit_price_snapshot',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14),
        ),
        migrations.AddField(
            model_name='wholesalecartitem',
            name='wholesale_unit_snapshot',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='notificationlog',
            name='recipient_business',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='wholesale_notifications',
                to='businesses.business',
            ),
        ),
        migrations.CreateModel(
            name='ProformaInvoice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('reference', models.CharField(blank=True, max_length=40)),
                ('status', models.CharField(
                    choices=[
                        ('DRAFT', 'Brouillon'),
                        ('PENDING_VALIDATION', 'En attente de validation'),
                        ('CONFIRMED', 'Confirmee'),
                        ('CANCELLED', 'Annulee'),
                        ('REJECTED', 'Refusee'),
                    ],
                    default='DRAFT',
                    max_length=30,
                )),
                ('subtotal', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('total', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('currency', models.CharField(default='BIF', max_length=10)),
                ('lines_snapshot', models.JSONField(blank=True, default=list)),
                ('generated_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cart', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='proformas',
                    to='wholesale.wholesalecart',
                )),
                ('client_business', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='wholesale_proformas',
                    to='businesses.business',
                )),
                ('order', models.OneToOneField(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='proforma',
                    to='wholesale.wholesaleorder',
                )),
                ('wholesale_business', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='wholesale_proformas_issued',
                    to='businesses.business',
                )),
            ],
            options={
                'ordering': ['-generated_at'],
            },
        ),
    ]
