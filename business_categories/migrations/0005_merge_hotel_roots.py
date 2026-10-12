"""Fusion des deux racines hôtelières.

Le catalogue contenait « Hôtellerie & Restauration » (5 enfants) et
« Hôtellerie et tourisme » (0 enfant, 1 entreprise) : l'annuaire public
affichait donc deux tuiles presque identiques. On conserve
« Hôtellerie et tourisme » comme racine unique et on y rattache les enfants,
puis on supprime la racine vide.
"""

from django.db import migrations

KEEP_SLUG = 'hotellerie-et-tourisme'
DROP_SLUG = 'hotellerie-restauration'


def merge_hotel_roots(apps, schema_editor):
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    keep = BusinessCategory.objects.filter(slug=KEEP_SLUG).first()
    drop = BusinessCategory.objects.filter(slug=DROP_SLUG).first()
    if not keep or not drop:
        return

    BusinessCategory.objects.filter(parent=drop).update(parent=keep)
    drop.delete()


def restore_hotel_roots(apps, schema_editor):
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    keep = BusinessCategory.objects.filter(slug=KEEP_SLUG).first()
    if not keep:
        return
    BusinessCategory.objects.create(
        name='Hôtellerie & Restauration',
        slug=DROP_SLUG,
        module=keep.module or 'hotel',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('business_categories', '0004_alter_businesscategory_module'),
    ]

    operations = [
        migrations.RunPython(merge_hotel_roots, restore_hotel_roots),
    ]
