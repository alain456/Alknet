import uuid

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0028_plan_quota_domain_invoice'),
    ]

    operations = [
        migrations.CreateModel(
            name='StockAlert',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sector', models.CharField(choices=[('commerce', 'Commerce'), ('retail', 'Pharmacie de détail'), ('wholesale', 'Pharmacie de gros')], max_length=20)),
                ('product_id', models.UUIDField()),
                ('variant_id', models.UUIDField(blank=True, null=True)),
                ('product_name', models.CharField(max_length=255)),
                ('level', models.CharField(choices=[('LOW', 'Stock faible'), ('OUT', 'Rupture')], max_length=8)),
                ('quantity', models.IntegerField(default=0)),
                ('threshold', models.PositiveIntegerField(default=0)),
                ('is_read', models.BooleanField(default=False)),
                ('is_resolved', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('business', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_alerts', to='businesses.business')),
            ],
            options={
                'verbose_name': 'Alerte de stock',
                'verbose_name_plural': 'Alertes de stock',
                'ordering': ['-created_at'],
            },
        ),
    ]
