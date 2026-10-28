from django.db import migrations


SERVICES_DESCRIPTION = (
    'Prestataires de services. Chaque prestataire précise sa catégorie à '
    'l’inscription. Isoko Hub fournit l’espace pour gérer la fiche, les offres '
    'et les demandes de contact.'
)

OLD_PARENT_SLUGS = (
    'services-professionnels',
    'services-a-la-personne',
)


def unify_services_sector(apps, schema_editor):
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    Business = apps.get_model('businesses', 'Business')
    Through = Business.categories.through

    services, _ = BusinessCategory.objects.get_or_create(
        slug='services',
        defaults={
            'name': 'Services',
            'icon': 'Briefcase',
            'description': SERVICES_DESCRIPTION,
            'module': 'services',
            'parent': None,
        },
    )
    services.name = 'Services'
    services.icon = 'Briefcase'
    services.description = SERVICES_DESCRIPTION
    services.module = 'services'
    services.parent = None
    services.save()

    old_parents = list(
        BusinessCategory.objects.filter(slug__in=OLD_PARENT_SLUGS).exclude(pk=services.pk)
    )
    old_ids = [row.pk for row in old_parents]

    if old_ids:
        BusinessCategory.objects.filter(parent_id__in=old_ids).update(
            parent=services, module='services',
        )
        Business.objects.filter(primary_category_id__in=old_ids).update(
            primary_category=services,
        )
        Business.objects.filter(category_id__in=old_ids).update(category=services)
        for link in Through.objects.filter(businesscategory_id__in=old_ids):
            already = Through.objects.filter(
                business_id=link.business_id, businesscategory_id=services.pk,
            ).exists()
            if already:
                link.delete()
            else:
                link.businesscategory_id = services.pk
                link.save(update_fields=['businesscategory_id'])
        BusinessCategory.objects.filter(pk__in=old_ids).delete()

    extras = BusinessCategory.objects.filter(
        module='services', parent__isnull=True,
    ).exclude(pk=services.pk)
    for extra in extras:
        extra.parent = services
        extra.module = 'services'
        extra.save(update_fields=['parent', 'module', 'updated_at'])

    BusinessCategory.objects.filter(parent_id=services.pk).update(module='services')


def noop_reverse(apps, schema_editor):
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('business_categories', '0006_services_module'),
        ('businesses', '0032_provider_module'),
    ]

    operations = [
        migrations.RunPython(unify_services_sector, noop_reverse),
    ]
