from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('business_categories', '0008_unify_hotel_tourism_root'),
    ]

    operations = [
        migrations.AddField(
            model_name='businesscategory',
            name='is_visible',
            field=models.BooleanField(
                default=True,
                help_text='Visible côté client (annuaire, inscription). Désactivé = brouillon admin.',
            ),
        ),
    ]
