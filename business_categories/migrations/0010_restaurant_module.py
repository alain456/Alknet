from django.db import migrations, models


FOOD_SLUGS = frozenset({'restaurant', 'bar', 'cafe', 'traiteur', 'resto'})
FOOD_TOKENS = ('restaurant', 'resto', 'traiteur', 'café', 'cafe')
FOOD_EXACT = frozenset({'bar', 'café', 'cafe'})


def _is_food(name, slug):
    blob = f'{name or ""} {slug or ""}'.lower()
    if any(token in blob for token in FOOD_TOKENS):
        return True
    return (slug or '').lower() in FOOD_EXACT or (name or '').lower().strip() in FOOD_EXACT


def attach_restaurant_module(apps, schema_editor):
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    for cat in BusinessCategory.objects.all():
        slug = cat.slug or ''
        name = cat.name or ''
        if slug.lower() in FOOD_SLUGS or _is_food(name, slug):
            if cat.module != 'restaurant':
                cat.module = 'restaurant'
                cat.save(update_fields=['module'])


def detach_restaurant_module(apps, schema_editor):
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    BusinessCategory.objects.filter(module='restaurant').update(module='hotel')


class Migration(migrations.Migration):

    dependencies = [
        ('business_categories', '0009_businesscategory_is_visible'),
    ]

    operations = [
        migrations.AlterField(
            model_name='businesscategory',
            name='module',
            field=models.CharField(
                blank=True,
                choices=[
                    ('business', 'Commerce générique'),
                    ('commerce', 'Commerce / boutique en ligne'),
                    ('hotel', 'Hôtellerie (PMS)'),
                    ('restaurant', 'Restauration'),
                    ('hospital', 'Santé / hôpital'),
                    ('retail_pharmacy', 'Pharmacie de détail'),
                    ('wholesale', 'Pharmacie de gros'),
                    ('education', 'Éducation'),
                    ('services', 'Services et prestataires'),
                ],
                default='',
                help_text='Module métier activé pour cette catégorie.',
                max_length=20,
            ),
        ),
        migrations.RunPython(attach_restaurant_module, detach_restaurant_module),
    ]
