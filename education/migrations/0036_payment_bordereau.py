from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0035_unit_tuition'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationfeepayment',
            name='method',
            field=models.CharField(
                blank=True,
                choices=[('BURUNDIPAY', 'BurundiPay'), ('BORDEREAU', 'Bordereau')],
                default='',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='educationfeepayment',
            name='bordereau',
            field=models.FileField(blank=True, null=True, upload_to='education/bordereaux/%Y/%m/'),
        ),
        migrations.RemoveConstraint(
            model_name='educationfeepayment',
            name='education_fee_payment_status_known',
        ),
        migrations.AddConstraint(
            model_name='educationfeepayment',
            constraint=models.CheckConstraint(
                condition=models.Q(status__in=['UNPAID', 'AWAITING_PIN', 'PAID', 'FAILED', 'WAIVED', 'BORDEREAU_RECU']),
                name='education_fee_payment_status_known',
            ),
        ),
    ]
