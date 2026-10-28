from django.db import migrations


def unify_hotel_tourism_root(apps, schema_editor):
    from business_categories.hotel_sector import merge_hotel_tourism_root

    merge_hotel_tourism_root(
        BusinessCategory=apps.get_model('business_categories', 'BusinessCategory'),
        Business=apps.get_model('businesses', 'Business'),
    )


def noop_reverse(apps, schema_editor):
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('business_categories', '0007_unify_services_sector'),
        ('businesses', '0033_rename_lumicash_merchant_account'),
    ]

    operations = [
        migrations.RunPython(unify_hotel_tourism_root, noop_reverse),
    ]
