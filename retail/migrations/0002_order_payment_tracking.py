# Generated manually — suivi paiement privé patient↔pharmacie

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('retail', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='retailorder',
            name='payment_method',
            field=models.CharField(blank=True, help_text='Ex: LUMICASH, CASH, BANK, OTHER — hors plateforme', max_length=40),
        ),
        migrations.AddField(
            model_name='retailorder',
            name='payment_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='retailorder',
            name='payment_status',
            field=models.CharField(choices=[('UNPAID', 'Non payée'), ('PAID', 'Payée')], default='UNPAID', max_length=20),
        ),
        migrations.AddField(
            model_name='retailorder',
            name='paid_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='retailorder',
            name='paid_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='retail_orders_marked_paid',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
