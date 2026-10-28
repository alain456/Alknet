from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from businesses.models import Business
from service_categories.models import ServiceCategory

from services.models import (
    ProviderDocument,
    Service,
    ServiceProviderProfile,
    ServiceSubItem,
    TeamMember,
)

User = get_user_model()


class Command(BaseCommand):
    help = 'Crée l’exemple SCVS (aide à domicile) pour le module Services.'

    def handle(self, *args, **options):
        from business_categories.models import BusinessCategory
        from business_categories.services_sector import get_services_root

        root = get_services_root()
        category = (
            BusinessCategory.objects.filter(slug='aide-a-domicile').first()
            or BusinessCategory.objects.filter(parent=root, name__iexact='Aide à domicile').first()
        )
        if not category:
            self.stderr.write('Catégorie « Aide à domicile » manquante. Préparez-la dans Catégories.')
            return

        home_cat, _ = ServiceCategory.objects.update_or_create(
            slug='service-a-domicile',
            defaults={
                'name': 'Service à domicile',
                'description': 'Garde d’enfants et accompagnement à domicile.',
            },
        )

        owner, _ = User.objects.get_or_create(
            email='scvs@isoko.com',
            defaults={
                'first_name': 'SCVS',
                'last_name': 'Coordination',
                'role': 'BUSINESS_OWNER',
                'is_active': True,
                'is_email_verified': True,
            },
        )
        owner.role = 'BUSINESS_OWNER'
        owner.is_active = True
        owner.is_email_verified = True
        owner.set_password('Isoko123!')
        owner.save()

        business, _ = Business.objects.update_or_create(
            name='SCVS',
            defaults={
                'owner': owner,
                'primary_category': category,
                'category': category,
                'description': (
                    'Aide et accompagnement à domicile : garde d’enfants et '
                    'soutien aux personnes âgées, malades ou fragiles.'
                ),
                'phone': '+257 79 00 11 22',
                'email': 'contact@scvs.bi',
                'commune': 'Mukaza',
                'province': 'Bujumbura Mairie',
                'quartier': 'Rohero',
                'address': 'Rohero, Bujumbura',
                'is_active': True,
                'is_verified': True,
                'verification_status': 'APPROVED',
            },
        )
        if business.owner_id != owner.id:
            business.owner = owner
            business.save(update_fields=['owner', 'updated_at'])
        business.categories.add(category)

        ServiceProviderProfile.objects.update_or_create(
            business=business,
            defaults={
                'commercial_name': 'SCVS — aide et accompagnement à domicile',
                'about': (
                    'SCVS met à disposition un personnel qualifié, vérifié et formé '
                    'pour la garde d’enfants et l’accompagnement des personnes fragiles. '
                    'Les interventions se font en journée, en soirée, le week-end et en urgence.'
                ),
                'coverage_zones': 'Bujumbura Mairie et communes voisines',
                'opening_hours': 'Tous les jours, y compris urgences',
                'show_phone': True,
                'show_email': True,
                'show_address': True,
                'is_published': True,
            },
        )

        home_subs = [
            {
                'title': 'Cuisine',
                'description': (
                    'Préparation des repas à domicile, selon les habitudes et le régime de la famille.'
                ),
                'image_urls': [
                    'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=900&q=80',
                ],
                'availability': 'Tous les jours, selon le rythme de la famille',
                'details': [
                    {'title': 'Ibikoresho', 'description': 'Tubazanira ibikoresho.'},
                    {'title': 'Guteka', 'description': 'Tubafasha mubijanye no guteka.'},
                ],
            },
            {
                'title': 'Accompagnement des personnes âgées, malades ou fragiles',
                'description': (
                    'Aide à la toilette, aux repas et aux déplacements. Personnel formé '
                    'à l’accompagnement des personnes fragiles. Présence rassurante contre '
                    'l’isolement. Coordination avec la famille et le personnel médical '
                    'lorsque cela est nécessaire.'
                ),
                'image_urls': [
                    'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=900&q=80',
                ],
                'availability': 'Journée, soirée et week-end',
                'details': [
                    {'title': 'Aide à la toilette, aux repas et aux déplacements'},
                    {'title': 'Présence contre l’isolement'},
                    {'title': 'Coordination famille et soignants'},
                ],
            },
            {
                'title': "Garde d'enfants",
                'description': (
                    'Personnel qualifié, vérifié et formé. Suivi adapté à l’âge de l’enfant, '
                    'aide aux devoirs et activités d’éveil. Accompagnement des familles '
                    'ayant un ou plusieurs enfants. Garde en journée, en soirée, le week-end et en urgence.'
                ),
                'image_urls': [
                    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80',
                ],
                'availability': 'Journée, soirée, week-end et urgences',
                'details': [
                    {'title': 'Garde en journée et en soirée'},
                    {'title': 'Aide aux devoirs et activités d’éveil'},
                    {'title': 'Garde d’urgence et week-end'},
                ],
            },
        ]
        existing = {row.title: row for row in Service.objects.filter(business=business)}
        home_offer, _ = Service.objects.update_or_create(
            business=business,
            title='Service à domicile',
            defaults={
                'professional': owner,
                'category': home_cat,
                'parent': None,
                'description': (
                    'Cuisine, garde d’enfants et accompagnement des personnes âgées, '
                    'malades ou fragiles, à domicile.'
                ),
                'modalities': 'Interventions à domicile, selon le rythme de la famille.',
                'availability': 'Tous les jours, y compris urgences',
                'coverage_zone': 'Bujumbura Mairie',
                'status': 'ACTIVE',
                'sort_order': 0,
            },
        )
        leftover_items = {item.title: item for item in home_offer.sub_items.all()}
        for index, spec in enumerate(home_subs):
            source = existing.get(spec['title'])
            leftover = leftover_items.get(spec['title'])
            description = spec['description']
            if source and source.pk != home_offer.pk and (source.description or '').strip():
                description = source.description.strip()
            elif leftover and (leftover.description or '').strip():
                description = leftover.description.strip()
            image_urls = spec['image_urls']
            if source and source.pk != home_offer.pk and source.image_urls:
                image_urls = list(source.image_urls)
            child, _ = Service.objects.update_or_create(
                business=business,
                title=spec['title'],
                defaults={
                    'professional': owner,
                    'category': home_cat,
                    'parent': home_offer,
                    'description': description,
                    'modalities': 'À domicile, selon le rythme de la famille.',
                    'availability': spec['availability'],
                    'coverage_zone': 'Bujumbura Mairie',
                    'image_urls': image_urls,
                    'status': 'ACTIVE',
                    'sort_order': index + 1,
                },
            )
            child.sub_items.all().delete()
            ServiceSubItem.objects.bulk_create([
                ServiceSubItem(
                    service=child,
                    title=row['title'],
                    description=row.get('description') or '',
                    sort_order=detail_index,
                )
                for detail_index, row in enumerate(spec['details'])
            ])
        home_offer.sub_items.all().delete()
        Service.objects.filter(business=business, title='Service a domicile').exclude(pk=home_offer.pk).delete()

        TeamMember.objects.filter(business=business, name='Équipe SCVS').delete()
        team = [
            {
                'name': 'Chantal Ndayishimiye',
                'role_title': 'Auxiliaire de vie',
                'qualifications': 'Formée à l’accompagnement des personnes âgées, malades ou fragiles.',
                'experience': 'Interventions à domicile auprès des familles de Bujumbura.',
                'photo_url': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=80',
            },
            {
                'name': 'Aline Hakizimana',
                'role_title': 'Garde d’enfants',
                'qualifications': 'Personnel vérifié, suivi adapté à l’âge de l’enfant, aide aux devoirs et éveil.',
                'experience': 'Garde en journée, en soirée et le week-end.',
                'photo_url': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&h=400&q=80',
            },
            {
                'name': 'Jean-Bosco Niyonkuru',
                'role_title': 'Accompagnement à domicile',
                'qualifications': 'Aide à la toilette, aux repas et aux déplacements. Coordination famille et soignants.',
                'experience': 'Présence contre l’isolement, y compris le week-end.',
                'photo_url': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80',
            },
        ]
        for index, row in enumerate(team):
            TeamMember.objects.update_or_create(
                business=business,
                name=row['name'],
                defaults={
                    'role_title': row['role_title'],
                    'qualifications': row['qualifications'],
                    'experience': row['experience'],
                    'photo_url': row['photo_url'],
                    'is_public': True,
                    'sort_order': index,
                },
            )
        activities = [
            {
                'title': 'Garde d’enfants à domicile',
                'description': 'Accompagnement d’une famille à Rohero : devoirs, jeux et présence rassurante.',
                'file_url': 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80',
            },
            {
                'title': 'Repas préparé à domicile',
                'description': 'Cuisine selon les habitudes de la famille, avec les ingrédients fournis.',
                'file_url': 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=900&q=80',
            },
            {
                'title': 'Accompagnement d’une personne âgée',
                'description': 'Aide à la toilette, aux repas et aux déplacements, en lien avec la famille.',
                'file_url': 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=900&q=80',
            },
        ]
        for index, row in enumerate(activities):
            ProviderDocument.objects.update_or_create(
                business=business,
                title=row['title'],
                defaults={
                    'kind': 'ACTIVITY',
                    'description': row['description'],
                    'file_url': row['file_url'],
                    'is_public': True,
                    'sort_order': index,
                },
            )
        ProviderDocument.objects.update_or_create(
            business=business,
            title='Témoignage d’une famille',
            defaults={
                'kind': 'TESTIMONY',
                'description': 'Exemple de témoignage vidéo. Le son est activé : lancez la lecture puis réglez le volume du lecteur.',
                'file_url': 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                'is_public': True,
                'sort_order': len(activities),
            },
        )
        ProviderDocument.objects.update_or_create(
            business=business,
            title='Attestation de services rendus',
            defaults={
                'kind': 'ATTESTATION',
                'is_public': True,
                'description': 'Attestation remise à la famille après une période d’accompagnement.',
                'file_url': 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
            },
        )
        ProviderDocument.objects.update_or_create(
            business=business,
            title='Certificat de formation du personnel',
            defaults={
                'kind': 'CERTIFICATE',
                'is_public': True,
                'description': 'Formation à la garde d’enfants et à l’accompagnement des personnes fragiles.',
                'file_url': 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80',
            },
        )
        ProviderDocument.objects.update_or_create(
            business=business,
            title='Dossier interne de vérification du personnel',
            defaults={'kind': 'OTHER', 'is_public': False, 'file_url': '', 'description': ''},
        )
        self.stdout.write(self.style.SUCCESS('Exemple SCVS prêt (compte scvs@isoko.com).'))
