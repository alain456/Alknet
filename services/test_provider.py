import base64
import tempfile
from io import BytesIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory, ModuleKey
from businesses.models import Business

from service_categories.models import ServiceCategory

from .models import ContactRequest, ProviderDocument, Service, ServiceProviderProfile, ServiceSubItem, TeamMember

User = get_user_model()


def listing_rows(response):
    data = response.data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


def jpeg_data_url(width=48, height=36, color=(12, 40, 70)):
    image = Image.new('RGB', (width, height), color)
    buffer = BytesIO()
    image.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f'data:image/jpeg;base64,{encoded}'


def video_data_url():
    blob = b'\x00\x00\x00\x18ftypmp42' + (b'\x00' * 64)
    return 'data:video/mp4;base64,' + base64.b64encode(blob).decode()


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class ServiceProviderTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.media_override = override_settings(MEDIA_ROOT=Path(self.tmp.name))
        self.media_override.enable()
        self.parent = BusinessCategory.objects.create(
            name='Services test parent', slug='services-test-parent', module=ModuleKey.SERVICES,
        )
        self.category = BusinessCategory.objects.create(
            name='Aide test', slug='aide-test',
            parent=self.parent, module=ModuleKey.SERVICES,
        )
        self.owner = User.objects.create_user(
            email='scvs@test.bi', password='test-pass', role='BUSINESS_OWNER',
        )
        self.other = User.objects.create_user(
            email='other@test.bi', password='test-pass', role='BUSINESS_OWNER',
        )
        self.business = Business.objects.create(
            owner=self.owner,
            primary_category=self.category,
            category=self.category,
            name='SCVS',
            email='contact@scvs.test',
            phone='79001122',
            address='Rohero',
            commune='Mukaza',
        )
        other_cat = BusinessCategory.objects.create(
            name='Avocat', slug='avocat-test', parent=self.parent, module=ModuleKey.SERVICES,
        )
        self.other_business = Business.objects.create(
            owner=self.other,
            primary_category=other_cat,
            category=other_cat,
            name='Cabinet Autre',
            email='autre@test.bi',
        )
        self.profile = ServiceProviderProfile.objects.create(
            business=self.business,
            commercial_name='SCVS — aide et accompagnement à domicile',
            about='Personnel qualifié et formé.',
            coverage_zones='Bujumbura Mairie',
            show_phone=True,
            show_email=False,
            is_published=True,
        )
        self.offer = Service.objects.create(
            business=self.business,
            professional=self.owner,
            title="Garde d'enfants",
            description='Personnel vérifié et formé.',
            availability='Journée, soirée, week-end et urgences',
            coverage_zone='Bujumbura Mairie',
            modalities='À domicile',
            status='ACTIVE',
        )
        ServiceSubItem.objects.create(service=self.offer, title='Aide aux devoirs')
        ProviderDocument.objects.create(
            business=self.business,
            title='Attestation publique',
            kind='ATTESTATION',
            description='Scan de l’attestation.',
            file_url='https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
            is_public=True,
        )
        ProviderDocument.objects.create(
            business=self.business, title='Dossier interne', kind='OTHER', is_public=False,
        )
        ProviderDocument.objects.create(
            business=self.business,
            title='Garde à domicile',
            kind='ACTIVITY',
            description='Intervention auprès d’une famille à Rohero.',
            file_url='https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80',
            is_public=True,
        )
        ProviderDocument.objects.create(
            business=self.business,
            title='Témoignage public',
            kind='TESTIMONY',
            description='Le son est activé sur cette vidéo.',
            file_url='https://media.w3.org/2010/05/sintel/trailer.mp4',
            is_public=True,
        )
        ProviderDocument.objects.create(
            business=self.business,
            title='Vidéo interne',
            kind='TESTIMONY',
            description='Témoignage non publié.',
            file_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            is_public=False,
        )
        TeamMember.objects.create(
            business=self.business,
            name='Chantal Ndayishimiye',
            role_title='Auxiliaire de vie',
            photo_url='https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
            is_public=True,
        )
        TeamMember.objects.create(
            business=self.business,
            name='Dossier RH interne',
            role_title='Coordination',
            is_public=False,
        )
        self.client = APIClient()

    def tearDown(self):
        self.media_override.disable()
        self.tmp.cleanup()

    def test_public_directory_hides_private_contacts_and_documents(self):
        listing = self.client.get('/api/v1/services/providers/')
        self.assertEqual(listing.status_code, 200)
        rows = listing_rows(listing)
        self.assertIn('count', listing.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['name'], 'SCVS — aide et accompagnement à domicile')
        sample = rows[0]['sample_offers']
        self.assertGreaterEqual(len(sample), 1)
        self.assertIn('sub_items', sample[0])
        self.assertIn('image', sample[0])
        self.assertIn('availability', sample[0])
        self.assertGreaterEqual(sample[0]['sub_item_count'], 1)

        detail = self.client.get(f'/api/v1/services/providers/{self.business.id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['phone'], '79001122')
        self.assertEqual(detail.data['email'], '')
        titles = [row['title'] for row in detail.data['documents']]
        self.assertIn('Attestation publique', titles)
        self.assertIn('Garde à domicile', titles)
        self.assertIn('Témoignage public', titles)
        self.assertNotIn('Dossier interne', titles)
        self.assertNotIn('Vidéo interne', titles)
        activity = next(row for row in detail.data['documents'] if row['title'] == 'Garde à domicile')
        self.assertEqual(activity['kind'], 'ACTIVITY')
        self.assertIn('Rohero', activity['description'])
        self.assertTrue(activity['file_url'].startswith('https://'))
        testimony = next(row for row in detail.data['documents'] if row['title'] == 'Témoignage public')
        self.assertEqual(testimony['kind'], 'TESTIMONY')
        self.assertTrue(testimony['file_url'].endswith('.mp4'))
        attestation = next(row for row in detail.data['documents'] if row['title'] == 'Attestation publique')
        self.assertEqual(attestation['kind'], 'ATTESTATION')
        self.assertTrue(attestation['file_url'].startswith('https://'))
        self.assertEqual(detail.data['offers'][0]['sub_items'][0]['title'], 'Aide aux devoirs')
        team_names = [row['name'] for row in detail.data['team']]
        self.assertIn('Chantal Ndayishimiye', team_names)
        self.assertNotIn('Dossier RH interne', team_names)
        chantal = next(row for row in detail.data['team'] if row['name'] == 'Chantal Ndayishimiye')
        self.assertTrue(chantal['photo_url'].startswith('https://'))

    def test_public_directory_search_matches_service_words(self):
        found = self.client.get('/api/v1/services/providers/?q=garde%20enfants')
        self.assertEqual(found.status_code, 200)
        self.assertEqual(len(listing_rows(found)), 1)
        missing = self.client.get('/api/v1/services/providers/?q=plomberie')
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(len(listing_rows(missing)), 0)

    def test_public_directory_filters_by_category_slug(self):
        listing = self.client.get('/api/v1/services/providers/?category=aide-test')
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing_rows(listing)), 1)
        missing = self.client.get('/api/v1/services/providers/?category=avocat-test')
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(len(listing_rows(missing)), 0)

    def test_public_directory_paginates_without_404(self):
        paged = self.client.get('/api/v1/services/providers/?page_size=1')
        self.assertEqual(paged.status_code, 200)
        self.assertEqual(paged.data['count'], 1)
        self.assertEqual(len(listing_rows(paged)), 1)
        overflow = self.client.get('/api/v1/services/providers/?page=9')
        self.assertEqual(overflow.status_code, 200)
        self.assertEqual(overflow.data['count'], 1)
        self.assertEqual(len(listing_rows(overflow)), 1)

    def test_guest_contact_reaches_the_right_provider(self):
        response = self.client.post(
            f'/api/v1/services/offers/{self.offer.id}/contact/',
            {
                'client_name': 'Aline N.',
                'client_email': 'aline@client.bi',
                'client_phone': '71000000',
                'client_address': 'Rohero, Bujumbura',
                'preferred_contact': 'PHONE',
                'message': 'Besoin d’une garde le week-end.',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['ok'])
        row = ContactRequest.objects.get()
        self.assertEqual(row.business_id, self.business.id)
        self.assertEqual(row.service_id, self.offer.id)
        self.assertEqual(row.client_address, 'Rohero, Bujumbura')
        self.assertEqual(row.status, 'NEW')
        self.assertTrue(row.reference.startswith('SCVS-'))
        self.assertEqual(response.data['reference'], row.reference)
        self.assertIn(row.public_token, response.data['follow_url'])
        self.assertEqual(len(mail.outbox), 2)
        provider_mail = next(item for item in mail.outbox if item.subject.startswith('Nouvelle demande'))
        client_mail = next(item for item in mail.outbox if item.subject.startswith('Votre demande'))
        self.assertIn('Rohero, Bujumbura', provider_mail.body)
        self.assertIn(row.reference, provider_mail.body)
        self.assertEqual(provider_mail.reply_to, ['aline@client.bi'])
        self.assertIn('contact@scvs.test', provider_mail.to)
        self.assertEqual(client_mail.to, ['aline@client.bi'])
        self.assertIn('SCVS', client_mail.body)
        self.assertIn(row.reference, client_mail.body)
        self.assertIn('Suivez le dossier', client_mail.body)

        follow = self.client.get(f'/api/v1/services/requests/{row.public_token}/')
        self.assertEqual(follow.status_code, 200)
        self.assertEqual(follow.data['reference'], row.reference)
        self.assertEqual(len(follow.data['messages']), 1)
        self.assertEqual(follow.data['messages'][0]['kind'], 'CLIENT')

        missing_address = self.client.post(
            f'/api/v1/services/providers/{self.business.id}/contact/',
            {
                'client_name': 'Jean',
                'client_email': 'jean@client.bi',
                'client_phone': '71000000',
                'message': 'Sans adresse',
            },
            format='json',
        )
        self.assertEqual(missing_address.status_code, 400)

        missing_phone = self.client.post(
            f'/api/v1/services/offers/{self.offer.id}/contact/',
            {
                'client_name': 'Jean',
                'client_email': 'jean@client.bi',
                'client_address': 'Kiriri',
                'preferred_contact': 'PHONE',
                'message': 'Sans téléphone',
            },
            format='json',
        )
        self.assertEqual(missing_phone.status_code, 400)

    def test_provider_sees_only_own_inbox_and_can_close(self):
        ContactRequest.objects.create(
            business=self.business,
            service=self.offer,
            client_name='Aline',
            client_email='aline@client.bi',
            message='Bonjour',
        )
        ContactRequest.objects.create(
            business=self.other_business,
            client_name='Intrus',
            client_email='intrus@test.bi',
            message='Ne pas voir',
        )
        self.client.force_authenticate(self.owner)
        inbox = self.client.get('/api/v1/services/me/inbox/')
        self.assertEqual(inbox.status_code, 200)
        rows = listing_rows(inbox)
        self.assertEqual(len(rows), 1)
        self.assertEqual(inbox.data['count'], 1)
        request_id = rows[0]['id']
        closed = self.client.patch(
            f'/api/v1/services/me/inbox/{request_id}/set_status/',
            {'status': 'CLOSED'},
            format='json',
        )
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.data['status'], 'CLOSED')
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(mail.outbox[0].subject.startswith('Mise à jour'))
        self.assertEqual(mail.outbox[0].to, ['aline@client.bi'])

        self.client.force_authenticate(self.other)
        foreign = self.client.get(f'/api/v1/services/me/inbox/{request_id}/')
        self.assertEqual(foreign.status_code, 404)

    def test_provider_reply_is_visible_on_the_dossier(self):
        created = self.client.post(
            f'/api/v1/services/offers/{self.offer.id}/contact/',
            {
                'client_name': 'Aline N.',
                'client_email': 'aline@client.bi',
                'client_phone': '71000000',
                'client_address': 'Rohero, Bujumbura',
                'message': 'Besoin d’une garde le week-end.',
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        request_id = created.data['id']
        token = ContactRequest.objects.get(pk=request_id).public_token
        mail.outbox.clear()

        self.client.force_authenticate(self.owner)
        opened = self.client.get(f'/api/v1/services/me/inbox/{request_id}/')
        self.assertEqual(opened.status_code, 200)
        self.assertEqual(opened.data['status'], 'IN_PROGRESS')

        note = self.client.post(
            f'/api/v1/services/me/inbox/{request_id}/reply/',
            {'body': 'À rappeler demain.', 'internal': True},
            format='json',
        )
        self.assertEqual(note.status_code, 200)
        self.assertEqual(note.data['status'], 'IN_PROGRESS')
        self.assertTrue(any(item['kind'] == 'INTERNAL' for item in note.data['messages']))

        replied = self.client.post(
            f'/api/v1/services/me/inbox/{request_id}/reply/',
            {'body': 'Nous pouvons venir samedi soir.'},
            format='json',
        )
        self.assertEqual(replied.status_code, 200)
        self.assertEqual(replied.data['status'], 'REPLIED')
        self.assertTrue(any(item['body'] == 'Nous pouvons venir samedi soir.' for item in replied.data['messages']))
        self.assertGreaterEqual(len(mail.outbox), 1)
        self.assertTrue(any(item.subject.startswith('Réponse') for item in mail.outbox))

        public = self.client.get(f'/api/v1/services/requests/{token}/')
        kinds = [item['kind'] for item in public.data['messages']]
        self.assertNotIn('INTERNAL', kinds)
        self.assertIn('PROVIDER', kinds)

        followup = self.client.post(
            f'/api/v1/services/requests/{token}/messages/',
            {'body': 'Samedi 18h convient.'},
            format='json',
        )
        self.assertEqual(followup.status_code, 201)
        self.assertEqual(followup.data['messages'][-1]['kind'], 'CLIENT')

        customer = User.objects.create_user(
            email='aline@client.bi', password='test-pass', role='CUSTOMER',
        )
        self.client.force_authenticate(customer)
        mine = self.client.get('/api/v1/services/me/requests/')
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(listing_rows(mine)[0]['id'], request_id)

    def test_merchant_cannot_patch_another_provider_offer(self):
        self.client.force_authenticate(self.other)
        response = self.client.patch(
            f'/api/v1/services/me/offers/{self.offer.id}/',
            {'title': 'Piraté'},
            format='json',
        )
        self.assertIn(response.status_code, (404, 403))
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.title, "Garde d'enfants")

    def test_merchant_deletes_child_without_removing_parent(self):
        parent = Service.objects.create(
            business=self.business,
            professional=self.owner,
            title='Service à domicile',
            description='Groupe',
            status='ACTIVE',
        )
        self.offer.parent = parent
        self.offer.save(update_fields=['parent', 'updated_at'])
        sibling = Service.objects.create(
            business=self.business,
            professional=self.owner,
            parent=parent,
            title='Cuisine',
            description='Repas à domicile.',
            status='ACTIVE',
        )
        self.client.force_authenticate(self.owner)
        response = self.client.delete(f'/api/v1/services/me/offers/{self.offer.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Service.objects.filter(pk=self.offer.pk).exists())
        self.assertFalse(ServiceSubItem.objects.filter(service_id=self.offer.pk).exists())
        self.assertTrue(Service.objects.filter(pk=parent.pk).exists())
        self.assertTrue(Service.objects.filter(pk=sibling.pk).exists())
        public = self.client.get(f'/api/v1/services/offers/{self.offer.id}/')
        self.assertEqual(public.status_code, 404)

    def test_merchant_deletes_parent_and_children(self):
        parent = Service.objects.create(
            business=self.business,
            professional=self.owner,
            title='Service à domicile',
            description='Groupe',
            status='ACTIVE',
        )
        self.offer.parent = parent
        self.offer.save(update_fields=['parent', 'updated_at'])
        request = ContactRequest.objects.create(
            business=self.business,
            service=self.offer,
            client_name='Aline',
            client_email='aline@client.bi',
            message='Bonjour',
        )
        self.client.force_authenticate(self.owner)
        response = self.client.delete(f'/api/v1/services/me/offers/{parent.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Service.objects.filter(pk=parent.pk).exists())
        self.assertFalse(Service.objects.filter(pk=self.offer.pk).exists())
        request.refresh_from_db()
        self.assertIsNone(request.service_id)
        listing = self.client.get(f'/api/v1/services/providers/{self.business.id}/')
        self.assertEqual(listing.status_code, 200)
        titles = [row['title'] for row in listing.data['offers']]
        self.assertNotIn("Garde d'enfants", titles)
        self.assertNotIn('Service à domicile', titles)

    def test_merchant_cannot_delete_another_provider_offer(self):
        self.client.force_authenticate(self.other)
        response = self.client.delete(f'/api/v1/services/me/offers/{self.offer.id}/')
        self.assertIn(response.status_code, (404, 403))
        self.assertTrue(Service.objects.filter(pk=self.offer.pk).exists())

    def test_provider_can_choose_prepared_service_category(self):
        other = BusinessCategory.objects.get(slug='avocat-test')
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            '/api/v1/services/me/profile/',
            {'category_id': str(other.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.business.refresh_from_db()
        self.assertEqual(self.business.primary_category_id, other.id)

    def test_profile_saves_essential_company_fields(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            '/api/v1/services/me/profile/',
            {
                'commercial_name': 'SCVS Bujumbura',
                'about': 'Aide à domicile.',
                'phone': '+257 79 00 11 22',
                'email': 'accueil@scvs.test',
                'commune': 'Ntahangwa',
                'province': 'Bujumbura Mairie',
                'zone': 'Ngagara',
                'quartier': 'Ngagara Q1',
                'coverage_zones': 'Mukaza et Ntahangwa',
                'opening_hours': 'Lun-Sam 7h-19h',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['commercial_name'], 'SCVS Bujumbura')
        self.assertEqual(response.data['commune'], 'Ntahangwa')
        self.assertEqual(response.data['zone'], 'Ngagara')
        self.business.refresh_from_db()
        self.assertEqual(self.business.phone, '+257 79 00 11 22')
        self.assertEqual(self.business.commune, 'Ntahangwa')

    def test_offer_can_exist_without_sub_services(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(
            '/api/v1/services/me/offers/',
            {
                'title': 'Conseil à domicile',
                'description': 'Évaluation des besoins de la famille.',
                'status': 'ACTIVE',
                'sub_items': [{'title': ''}, {'title': '  '}],
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['title'], 'Conseil à domicile')
        self.assertEqual(created.data['sub_items'], [])
        self.assertEqual(Service.objects.get(id=created.data['id']).sub_items.count(), 0)

    def test_admin_manages_service_categories_dynamically(self):
        listing = self.client.get('/api/v1/service-categories/')
        self.assertEqual(listing.status_code, 200)
        denied = self.client.post(
            '/api/v1/service-categories/',
            {'name': 'Catégorie pirate'},
            format='json',
        )
        self.assertIn(denied.status_code, (401, 403))
        admin = User.objects.create_user(
            email='super-svc-cat@test.bi', password='test-pass', role='SUPER_ADMIN',
        )
        self.client.force_authenticate(admin)
        created = self.client.post(
            '/api/v1/service-categories/',
            {'name': 'Garde personnalisée test', 'description': 'Référentiel admin'},
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['name'], 'Garde personnalisée test')
        self.assertTrue(created.data.get('slug'))
        pk = created.data['id']
        updated = self.client.patch(
            f'/api/v1/service-categories/{pk}/',
            {'name': 'Garde à domicile test'},
            format='json',
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['name'], 'Garde à domicile test')

    def test_merchant_defines_sub_services_company_keeps_its_category(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(
            '/api/v1/services/me/offers/',
            {
                'title': 'Nounou SCVS',
                'description': 'Garde selon le rythme de la famille.',
                'status': 'ACTIVE',
                'sub_items': [
                    {'title': 'Aide aux devoirs', 'description': 'Primaire et collège'},
                ],
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['title'], 'Nounou SCVS')
        self.assertEqual(created.data['category_name'], 'Aide test')
        self.assertEqual(created.data['sub_items'][0]['title'], 'Aide aux devoirs')
        detail = self.client.get(f'/api/v1/services/providers/{self.business.id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['category_name'], 'Aide test')
        offer = next(row for row in detail.data['offers'] if row['title'] == 'Nounou SCVS')
        self.assertEqual(offer['category_name'], 'Aide test')
        self.assertEqual(offer['title'], 'Nounou SCVS')

    def test_admin_lists_children_as_the_only_grouping(self):
        parent = Service.objects.create(
            business=self.business,
            professional=self.owner,
            title='Service à domicile',
            description='Prestations à domicile.',
            status='ACTIVE',
        )
        self.offer.parent = parent
        self.offer.save(update_fields=['parent', 'updated_at'])
        ServiceSubItem.objects.create(service=parent, title='Ancien regroupement')
        admin = User.objects.create_user(
            email='super-svc-group@test.bi', password='test-pass', role='SUPER_ADMIN',
        )
        self.client.force_authenticate(admin)
        listing = self.client.get('/api/v1/services/admin/list/')
        self.assertEqual(listing.status_code, 200)
        rows = listing.data if isinstance(listing.data, list) else listing.data.get('results') or []
        row = next(item for item in rows if item['title'] == 'Service à domicile')
        self.assertEqual([child['title'] for child in row['grouped_services']], ["Garde d'enfants"])
        self.assertEqual(row['sub_items'], [])
        self.assertFalse(Service.objects.filter(pk=parent.pk).first().sub_items.exists())

    def test_admin_list_shows_company_category_and_sub_services(self):
        admin = User.objects.create_user(
            email='super-svc-list@test.bi', password='test-pass', role='SUPER_ADMIN',
        )
        self.client.force_authenticate(admin)
        listing = self.client.get('/api/v1/services/admin/list/')
        self.assertEqual(listing.status_code, 200)
        rows = listing.data if isinstance(listing.data, list) else listing.data.get('results') or []
        row = next(item for item in rows if item['title'] == "Garde d'enfants")
        self.assertEqual(row['category_name'], 'Aide test')
        self.assertEqual(row['sub_items'][0]['title'], 'Aide aux devoirs')

    def test_merchant_groups_sub_services_on_one_offer(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(
            '/api/v1/services/me/offers/',
            {
                'title': 'Service à domicile',
                'description': 'Prestations à domicile pour les familles.',
                'status': 'ACTIVE',
                'sub_items': [
                    {'title': 'Cuisine', 'description': 'Repas à domicile.'},
                    {'title': "Garde d'enfants"},
                ],
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        offer_id = created.data['id']
        self.assertEqual([item['title'] for item in created.data['sub_items']], ['Cuisine', "Garde d'enfants"])
        patched = self.client.patch(
            f'/api/v1/services/me/offers/{offer_id}/',
            {
                'sub_items': [
                    {'title': 'Cuisine', 'description': 'Repas à domicile.'},
                    {
                        'title': 'Accompagnement des personnes âgées, malades ou fragiles',
                        'description': 'Aide aux personnes fragiles.',
                    },
                    {'title': "Garde d'enfants"},
                ],
            },
            format='json',
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        titles = [item['title'] for item in patched.data['sub_items']]
        self.assertEqual(titles, [
            'Cuisine',
            'Accompagnement des personnes âgées, malades ou fragiles',
            "Garde d'enfants",
        ])
        detail = self.client.get(f'/api/v1/services/providers/{self.business.id}/')
        offer = next(row for row in detail.data['offers'] if row['title'] == 'Service à domicile')
        self.assertEqual([item['title'] for item in offer['sub_items']], titles)

    def test_merchant_creates_detailed_grouped_sous_service(self):
        self.client.force_authenticate(self.owner)
        parent = self.client.post(
            '/api/v1/services/me/offers/',
            {
                'title': 'Service à domicile',
                'description': 'Prestations à domicile pour les familles.',
                'status': 'ACTIVE',
            },
            format='json',
        )
        self.assertEqual(parent.status_code, 201, parent.data)
        child = self.client.post(
            '/api/v1/services/me/offers/',
            {
                'title': 'Cuisine',
                'description': 'Préparation des repas à domicile.',
                'parent': parent.data['id'],
                'image_urls': ['https://example.com/cuisine.jpg'],
                'status': 'ACTIVE',
            },
            format='json',
        )
        self.assertEqual(child.status_code, 201, child.data)
        self.assertEqual(child.data['parent_title'], 'Service à domicile')
        self.assertEqual(child.data['image_urls'], ['https://example.com/cuisine.jpg'])
        detail = self.client.get(f'/api/v1/services/providers/{self.business.id}/')
        by_title = {row['title']: row for row in detail.data['offers']}
        self.assertEqual(by_title['Cuisine']['parent_title'], 'Service à domicile')
        self.assertEqual(by_title['Cuisine']['image_urls'], ['https://example.com/cuisine.jpg'])

    def test_parent_service_groups_company_named_services(self):
        parent = Service.objects.create(
            business=self.business,
            professional=self.owner,
            title='Service à domicile',
            description='Garde d’enfants et accompagnement à domicile.',
            status='ACTIVE',
        )
        self.offer.parent = parent
        self.offer.save(update_fields=['parent', 'updated_at'])
        Service.objects.create(
            business=self.business,
            professional=self.owner,
            title='Accompagnement des personnes âgées',
            description='Aide aux personnes fragiles.',
            status='ACTIVE',
            parent=parent,
        )
        detail = self.client.get(f'/api/v1/services/providers/{self.business.id}/')
        self.assertEqual(detail.status_code, 200)
        by_title = {row['title']: row for row in detail.data['offers']}
        self.assertEqual(by_title["Garde d'enfants"]['parent_title'], 'Service à domicile')
        self.assertEqual(str(by_title["Garde d'enfants"]['parent']), str(parent.id))
        self.assertEqual(by_title['Accompagnement des personnes âgées']['parent_title'], 'Service à domicile')
        self.assertFalse(by_title['Service à domicile']['parent'])
        listing = self.client.get('/api/v1/services/providers/')
        sample_titles = [row['title'] for row in listing_rows(listing)[0]['sample_offers']]
        self.assertIn("Garde d'enfants", sample_titles)
        self.assertNotIn('Service à domicile', sample_titles)
        self.assertEqual(listing_rows(listing)[0]['offer_count'], 2)

    def test_merchant_rejects_invalid_image_payload(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            '/api/v1/services/me/offers/',
            {
                'title': 'Photo invalide',
                'description': 'Test',
                'status': 'ACTIVE',
                'image_urls': ['javascript:alert(1)'],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_merchant_saves_team_photo_and_rejects_invalid_payload(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(
            '/api/v1/services/me/team/',
            {
                'name': 'Marie N.',
                'role_title': 'Garde d’enfants',
                'photo_url': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
                'is_public': True,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.data['photo_url'].startswith('https://'))
        invalid = self.client.post(
            '/api/v1/services/me/team/',
            {
                'name': 'Photo invalide',
                'photo_url': 'javascript:alert(1)',
            },
            format='json',
        )
        self.assertEqual(invalid.status_code, 400)

    def test_merchant_saves_activity_and_rejects_invalid_video(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(
            '/api/v1/services/me/documents/',
            {
                'title': 'Cuisine du midi',
                'kind': 'ACTIVITY',
                'description': 'Repas préparé à Mukaza.',
                'file_url': 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=900&q=80',
                'is_public': True,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['kind'], 'ACTIVITY')
        self.assertIn('Mukaza', created.data['description'])
        video = self.client.post(
            '/api/v1/services/me/documents/',
            {
                'title': 'Témoignage',
                'kind': 'TESTIMONY',
                'description': 'Une famille raconte.',
                'file_url': 'javascript:alert(1)',
                'is_public': True,
            },
            format='json',
        )
        self.assertEqual(video.status_code, 400)
        paper = self.client.post(
            '/api/v1/services/me/documents/',
            {
                'title': 'Attestation scan',
                'kind': 'ATTESTATION',
                'description': 'Document scanné.',
                'file_url': 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80',
                'is_public': True,
            },
            format='json',
        )
        self.assertEqual(paper.status_code, 201)
        self.assertEqual(paper.data['kind'], 'ATTESTATION')
        missing = self.client.post(
            '/api/v1/services/me/documents/',
            {'title': 'Sans image', 'kind': 'CERTIFICATE', 'is_public': True},
            format='json',
        )
        self.assertEqual(missing.status_code, 400)

    def test_inbox_paginates_without_404(self):
        self.client.force_authenticate(self.owner)
        for index in range(3):
            ContactRequest.objects.create(
                business=self.business,
                client_name=f'Client {index}',
                client_email=f'c{index}@test.bi',
                message='Bonjour',
            )
        page1 = self.client.get('/api/v1/services/me/inbox/?page_size=2')
        self.assertEqual(page1.status_code, 200)
        self.assertEqual(page1.data['count'], 3)
        self.assertEqual(len(listing_rows(page1)), 2)
        overflow = self.client.get('/api/v1/services/me/inbox/?page=9&page_size=2')
        self.assertEqual(overflow.status_code, 200)
        self.assertEqual(len(listing_rows(overflow)), 1)

    def test_uploaded_media_are_stored_as_public_files(self):
        self.client.force_authenticate(self.owner)
        team = self.client.post(
            '/api/v1/services/me/team/',
            {'name': 'Marie N.', 'photo_url': jpeg_data_url(), 'is_public': True},
            format='json',
        )
        self.assertEqual(team.status_code, 201, team.data)
        self.assertTrue(team.data['photo_url'].startswith('/media/public/services/portraits/'))
        member = TeamMember.objects.get(id=team.data['id'])
        self.assertFalse(member.photo_url.startswith('data:'))

        paper = self.client.post(
            '/api/v1/services/me/documents/',
            {
                'title': 'Scan attestation',
                'kind': 'ATTESTATION',
                'file_url': jpeg_data_url(60, 80, (240, 240, 240)),
                'is_public': True,
            },
            format='json',
        )
        self.assertEqual(paper.status_code, 201, paper.data)
        self.assertTrue(paper.data['file_url'].startswith('/media/public/services/docs/'))
        stored = ProviderDocument.objects.get(id=paper.data['id'])
        self.assertFalse(stored.file_url.startswith('data:'))

        video = self.client.post(
            '/api/v1/services/me/documents/',
            {
                'title': 'Clip famille',
                'kind': 'TESTIMONY',
                'file_url': video_data_url(),
                'is_public': True,
            },
            format='json',
        )
        self.assertEqual(video.status_code, 201, video.data)
        self.assertTrue(video.data['file_url'].startswith('/media/public/services/videos/'))

        guest = APIClient()
        image = guest.get(paper.data['file_url'].split('?', 1)[0])
        self.assertEqual(image.status_code, 200)

        public = guest.get(f'/api/v1/services/providers/{self.business.id}/')
        self.assertEqual(public.status_code, 200)
        titles = {row['title']: row['file_url'] for row in public.data['documents']}
        self.assertTrue(titles['Scan attestation'].startswith('/media/public/services/'))
        self.assertFalse(titles['Scan attestation'].startswith('data:'))
