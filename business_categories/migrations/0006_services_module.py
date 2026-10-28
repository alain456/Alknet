from django.db import migrations, models


SERVICES_PARENT_SLUGS = (
    'services-professionnels',
    'services-a-la-personne',
)
SERVICES_CHILD_SLUGS = (
    'avocat',
    'comptable',
    'consultant',
    'architecte',
    'agence',
    'garde-denfants',
    'aide-a-domicile',
    'accompagnement-personnes-agees',
)

HOME_HELP = {
    'name': 'Services à la personne',
    'slug': 'services-a-la-personne',
    'icon': 'Heart',
    'description': 'Garde d’enfants, aide à domicile et accompagnement des personnes fragiles.',
    'children': [
        {
            'name': "Garde d'enfants",
            'slug': 'garde-denfants',
            'icon': 'Heart',
            'description': 'Garde, aide aux devoirs et activités d’éveil.',
        },
        {
            'name': 'Aide à domicile',
            'slug': 'aide-a-domicile',
            'icon': 'Heart',
            'description': 'Aide et accompagnement à domicile.',
        },
        {
            'name': 'Accompagnement des personnes âgées',
            'slug': 'accompagnement-personnes-agees',
            'icon': 'Heart',
            'description': 'Accompagnement des personnes âgées, malades ou en situation de handicap.',
        },
    ],
}


def attach_services_module(apps, schema_editor):
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    parent, _ = BusinessCategory.objects.get_or_create(
        slug=HOME_HELP['slug'],
        defaults={
            'name': HOME_HELP['name'],
            'icon': HOME_HELP['icon'],
            'description': HOME_HELP['description'],
            'module': 'services',
        },
    )
    parent.name = HOME_HELP['name']
    parent.icon = HOME_HELP['icon']
    parent.description = HOME_HELP['description']
    parent.module = 'services'
    parent.parent = None
    parent.save()
    for child in HOME_HELP['children']:
        row, _ = BusinessCategory.objects.get_or_create(
            slug=child['slug'],
            defaults={
                'name': child['name'],
                'icon': child['icon'],
                'description': child['description'],
                'parent': parent,
                'module': 'services',
            },
        )
        row.name = child['name']
        row.icon = child['icon']
        row.description = child['description']
        row.parent = parent
        row.module = 'services'
        row.save()
    BusinessCategory.objects.filter(slug__in=SERVICES_PARENT_SLUGS).update(module='services')
    BusinessCategory.objects.filter(slug__in=SERVICES_CHILD_SLUGS).update(module='services')
    BusinessCategory.objects.filter(parent__slug__in=SERVICES_PARENT_SLUGS).update(module='services')


def detach_services_module(apps, schema_editor):
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    BusinessCategory.objects.filter(slug__in=SERVICES_PARENT_SLUGS).update(module='business')
    BusinessCategory.objects.filter(slug__in=SERVICES_CHILD_SLUGS).update(module='business')


class Migration(migrations.Migration):

    dependencies = [
        ('business_categories', '0005_merge_hotel_roots'),
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
        migrations.RunPython(attach_services_module, detach_services_module),
    ]
