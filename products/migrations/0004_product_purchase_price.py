from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_variant_color_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='purchase_price',
            field=models.DecimalField(decimal_places=2, default=0, help_text="Prix d'achat unitaire. Le vendeur le saisit pour calculer le bénéfice.", max_digits=14),
        ),
    ]
