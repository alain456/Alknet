import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('businesses', '0029_stock_alert'),
    ]

    operations = [
        migrations.CreateModel(
            name='InventorySession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sector', models.CharField(choices=[('commerce', 'Commerce'), ('retail', 'Pharmacie de détail'), ('wholesale', 'Pharmacie de gros')], max_length=20)),
                ('status', models.CharField(choices=[('OPEN', 'En cours'), ('VALIDATED', 'Validé'), ('CANCELLED', 'Abandonné')], default='OPEN', max_length=20)),
                ('opened_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('validated_at', models.DateTimeField(blank=True, null=True)),
                ('business', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory_sessions', to='businesses.business')),
                ('opened_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_sessions_opened', to=settings.AUTH_USER_MODEL)),
                ('validated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_sessions_validated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Inventaire',
                'verbose_name_plural': 'Inventaires',
                'ordering': ['-opened_at'],
            },
        ),
        migrations.CreateModel(
            name='InventoryLine',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('product_id', models.UUIDField()),
                ('variant_id', models.UUIDField(blank=True, null=True)),
                ('product_name', models.CharField(max_length=255)),
                ('sku', models.CharField(blank=True, default='', max_length=80)),
                ('batch_number', models.CharField(blank=True, default='', max_length=120)),
                ('expiration_date', models.DateField(blank=True, null=True)),
                ('theoretical_qty', models.PositiveIntegerField()),
                ('counted_qty', models.PositiveIntegerField(blank=True, null=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='businesses.inventorysession')),
            ],
            options={
                'ordering': ['product_name'],
            },
        ),
        migrations.AddConstraint(
            model_name='inventoryline',
            constraint=models.UniqueConstraint(condition=models.Q(('variant_id__isnull', True)), fields=('session', 'product_id'), name='uniq_inventory_line_product'),
        ),
        migrations.AddConstraint(
            model_name='inventoryline',
            constraint=models.UniqueConstraint(condition=models.Q(('variant_id__isnull', False)), fields=('session', 'variant_id'), name='uniq_inventory_line_variant'),
        ),
    ]
