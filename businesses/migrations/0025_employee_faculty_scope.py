from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0024_payment_receipt_and_invitation'),
    ]

    operations = [
        migrations.AddField(
            model_name='businessemployee',
            name='education_scope_unit',
            field=models.UUIDField(
                blank=True,
                help_text='Université : faculté dont cet employé voit les programmes et les dossiers. Vide : tout l’établissement.',
                null=True,
            ),
        ),
    ]
