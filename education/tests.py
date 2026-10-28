"""Non-régression du module Éducation.

Les quatre scénarios imposés au cahier des charges :
  * un visiteur ne voit pas un brouillon ;
  * un établissement A ne lit pas les données de B ;
  * le super admin plateforme n'entre pas dans les listes métier ;
  * une formation ne peut pas être rattachée à la structure d'un autre.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from business_categories.models import BusinessCategory, ModuleKey
from businesses.models import Business, BusinessEmployee, BusinessRole
from education.models import (
    EducationFee, EducationFeePayment, EducationProfile, EducationProgram,
    EducationUnit, PublicationStatus,
)
from education.permission_catalog import (
    PROFILE_UPDATE,
    PROGRAMS_MANAGE,
    STRUCTURE_MANAGE,
    expand_education_permissions,
)
from education.permissions import is_education_business

User = get_user_model()


class EducationBaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = BusinessCategory.objects.create(
            name='Éducation', slug='education', module=ModuleKey.EDUCATION,
        )
        self.child = BusinessCategory.objects.create(
            name='Université', slug='universite', parent=self.parent,
            module=ModuleKey.EDUCATION,
        )
        self.other_category = BusinessCategory.objects.create(
            name='Commerce', slug='commerce', module=ModuleKey.COMMERCE,
        )

        self.owner = User.objects.create_user(
            email='recteur@edu.test', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.owner_b = User.objects.create_user(
            email='recteur-b@edu.test', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.student = User.objects.create_user(
            email='etudiant@edu.test', password='Pass123456!', role='CUSTOMER',
        )
        self.super_admin = User.objects.create_user(
            email='super@edu.test', password='Pass123456!', role='SUPER_ADMIN',
        )

        self.school_a = Business.objects.create(
            owner=self.owner, primary_category=self.child, category=self.child,
            name='Université A', email='a@edu.test', province='Bujumbura Mairie',
        )
        self.school_b = Business.objects.create(
            owner=self.owner_b, primary_category=self.child, category=self.child,
            name='Université B', email='b@edu.test', province='Gitega',
        )
        self.shop_owner = User.objects.create_user(
            email='boutique@edu.test', password='Pass123456!', role='BUSINESS_OWNER',
        )
        self.shop = Business.objects.create(
            owner=self.shop_owner, primary_category=self.other_category,
            category=self.other_category, name='Boutique', email='shop@edu.test',
        )

        self.draft = EducationProfile.objects.create(
            business=self.school_a, establishment_type='UNIVERSITY',
            publication_status=PublicationStatus.DRAFT,
        )
        self.published = EducationProfile.objects.create(
            business=self.school_b, establishment_type='UNIVERSITY',
            publication_status=PublicationStatus.PUBLISHED, short_description='Publiee',
        )
        self.program_public = EducationProgram.objects.create(
            business=self.school_b, title='Licence Informatique',
            degree_awarded='Licence', level='LICENCE', is_public=True,
        )
        self.program_private = EducationProgram.objects.create(
            business=self.school_b, title='Master Secret', is_public=False,
        )


class EnumChoicesTests(EducationBaseTests):
    """Les listes d'options du front doivent venir du modèle.

    Elles étaient recopiées en React et avaient divergé : le filtre « type
    d'établissement » renvoyait zéro résultat parce que les valeurs envoyées
    n'existaient pas en base.
    """

    def test_enum_choices_are_public(self):
        response = APIClient().get('/api/v1/education/enum-choices/')
        self.assertEqual(response.status_code, 200)

    def test_enum_choices_match_model_choices(self):
        data = APIClient().get('/api/v1/education/enum-choices/').data
        self.assertEqual(
            [i['value'] for i in data['establishment_types']],
            [v for v, _ in EducationProfile.ESTABLISHMENT_TYPE_CHOICES],
        )
        self.assertEqual(
            [i['value'] for i in data['levels']],
            [v for v, _ in EducationProgram.LEVEL_CHOICES],
        )
        self.assertEqual(
            [i['value'] for i in data['unit_kinds']],
            [v for v, _ in EducationUnit.UNIT_KIND_CHOICES],
        )
        self.assertEqual(
            [i['value'] for i in data['particularities']],
            [v for v, _ in EducationProfile.PARTICULARITY_FIELDS],
        )

    def test_directory_type_filter_matches_a_real_value(self):
        """Régression : le filtre ne doit accepter que des valeurs du modèle."""
        value, _label = EducationProfile.ESTABLISHMENT_TYPE_CHOICES[0]
        self.published.establishment_type = value
        self.published.save(update_fields=['establishment_type'])
        rows = APIClient().get(f'/api/v1/education/profiles/?type={value}').data
        self.assertEqual([r['business_name'] for r in rows], [self.school_b.name])

    def test_directory_follows_the_business_category(self):
        """Les quatre enfants (Université, École…) sont des catégories, pas un type figé."""
        self.published.establishment_type = ''
        self.published.save(update_fields=['establishment_type'])
        BusinessCategory.objects.create(
            name='École', slug='ecole', parent=self.parent, module=ModuleKey.EDUCATION,
        )
        rows = APIClient().get('/api/v1/education/profiles/?category=universite').data
        self.assertEqual([r['business_name'] for r in rows], [self.school_b.name])
        self.assertEqual(rows[0]['category_slug'], 'universite')
        self.assertEqual(rows[0]['category_name'], 'Université')
        empty = APIClient().get('/api/v1/education/profiles/?category=ecole').data
        self.assertEqual(list(empty), [])


class PublicProfileByBusinessTests(EducationBaseTests):
    """Résolution de la fiche publique depuis l'id `Business`.

    La liste générale des entreprises adresse toutes les catégories par
    `business.id`. Sans cette action, le bouton « Voir l'établissement » d'une
    école menait à une page 404 : l'id reçu n'était pas celui de la fiche.
    """

    def test_published_profile_is_resolvable_from_business_id(self):
        response = APIClient().get(
            f'/api/v1/education/profiles/by-business/{self.school_b.id}/',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['id'], str(self.published.id))
        self.assertEqual(response.data['business_name'], self.school_b.name)

    def test_profile_url_accepts_the_business_id(self):
        response = APIClient().get(f'/api/v1/education/profiles/{self.school_b.id}/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['id'], str(self.published.id))

    def test_distance_uses_the_road_between_the_two_gps_points(self):
        from unittest.mock import patch
        with patch('education.geo.road_distance', return_value={
            'distance_km': 1.59, 'duration_minutes': 3, 'kind': 'driving',
        }):
            response = APIClient().get(
                '/api/v1/education/distance/',
                {'from_lat': -3.39, 'from_lng': 29.36, 'to_lat': -3.3821049, 'to_lng': 29.3583212},
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['kind'], 'driving')
        self.assertEqual(response.data['distance_km'], 1.59)

    def test_school_can_publish_ecofo_and_post_fondamental_sections(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        response = client.patch('/api/v1/education/profiles/my_profile/', {
            'offers_ecofo': True,
            'offers_post_fondamental': True,
            'ecofo_cycles': ['C1', 'C4'],
            'ecofo_classes': [
                {'value': '1', 'label': '1ère année'},
                {'value': '7', 'label': '7ème année'},
            ],
            'post_fondamental_sections': [
                {
                    'orientation': 'GENERAL',
                    'name': 'Langues',
                    'classes': [{'value': '1', 'label': '1ère année'}],
                },
                {
                    'orientation': 'TECHNIQUE',
                    'name': 'Informatique',
                    'classes': [{'value': '1', 'label': '1ère année'}, {'value': '2', 'label': '2ème année'}],
                },
            ],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        public = APIClient().get(f'/api/v1/education/profiles/{self.published.id}/').data
        self.assertTrue(public['offers_ecofo'])
        self.assertEqual(public['ecofo_cycles'], ['C1', 'C4'])
        self.assertEqual(
            [row['value'] for row in public['ecofo_classes']],
            ['1', '7'],
        )
        self.assertEqual(
            [section['name'] for section in public['post_fondamental_sections']],
            ['Langues', 'Informatique'],
        )
        self.assertEqual(
            [row['label'] for row in public['post_fondamental_sections'][1]['classes']],
            ['1ère année', '2ème année'],
        )
        both = APIClient().get('/api/v1/education/profiles/?track=both').data
        self.assertIn(self.school_b.name, [row['business_name'] for row in both])

    def test_draft_profile_is_not_resolvable(self):
        self.published.publication_status = PublicationStatus.DRAFT
        self.published.save(update_fields=['publication_status'])
        response = APIClient().get(
            f'/api/v1/education/profiles/by-business/{self.school_b.id}/',
        )
        self.assertEqual(response.status_code, 404)

    def test_cancelled_subscription_is_not_resolvable(self):
        self.school_b.subscription.status = 'CANCELLED'
        self.school_b.subscription.save(update_fields=['status'])
        response = APIClient().get(
            f'/api/v1/education/profiles/by-business/{self.school_b.id}/',
        )
        self.assertEqual(response.status_code, 404)

    def test_non_education_business_returns_404(self):
        response = APIClient().get(
            f'/api/v1/education/profiles/by-business/{self.shop.id}/',
        )
        self.assertEqual(response.status_code, 404)

    def test_authenticated_staff_also_only_sees_published(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        response = client.get(
            f'/api/v1/education/profiles/by-business/{self.school_a.id}/',
        )
        # Le brouillon de A reste invisible, même pour le propriétaire de B.
        self.assertEqual(response.status_code, 404)


class InstitutionRecordFieldsTests(EducationBaseTests):
    """Champs ajoutés d'après le document de spécification (§3 et §4.2)."""

    def test_establishment_can_publish_its_institutional_record(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        response = client.patch(
            '/api/v1/education/profiles/my_profile/',
            {
                'official_name': 'Université de Bujumbura',
                'description': 'Établissement public d’enseignement supérieur.',
                'academic_calendar': 'Deux semestres, rentrée en octobre.',
                'nearby_landmarks': 'Rohero I, Marché du Centre',
                'gallery': ['https://ex.test/campus.jpg'],
                'student_services': [
                    {'label': 'Bibliothèque', 'description': '20 000 ouvrages'},
                    {'label': 'Cantine', 'description': ''},
                ],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.published.refresh_from_db()
        self.assertEqual(self.published.official_name, 'Université de Bujumbura')
        self.assertEqual(self.published.academic_calendar, 'Deux semestres, rentrée en octobre.')
        self.assertEqual(self.published.gallery, ['https://ex.test/campus.jpg'])
        self.assertEqual(
            self.published.student_services[0],
            {'label': 'Bibliothèque', 'description': '20 000 ouvrages'},
        )

    def test_public_detail_exposes_the_institutional_record(self):
        data = APIClient().get(f'/api/v1/education/profiles/{self.published.id}/').data
        for field in (
            'official_name', 'description', 'gallery', 'student_services',
            'academic_calendar', 'nearby_landmarks',
        ):
            self.assertIn(field, data)

    def test_malformed_student_service_is_rejected(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        response = client.patch(
            '/api/v1/education/profiles/my_profile/',
            {'student_services': ['Bibliothèque']},
            format='json',
        )
        # Une chaîne seule n'est pas un objet {label, description}.
        self.assertEqual(response.status_code, 400)


class LocationAccessTests(EducationBaseTests):
    """La fiche et l'annuaire suivent le référentiel géographique, pas une liste figée."""

    def setUp(self):
        super().setUp()
        from locations.models import Commune, Province, Quartier, Zone

        self.school_b.commune = 'Mukaza'
        self.school_b.zone = 'Rohero'
        self.school_b.quartier = 'Rohero I'
        self.school_b.avenue = 'Avenue de l\'Indépendance'
        self.school_b.latitude = -3.3822
        self.school_b.longitude = 29.3644
        self.school_b.save()
        province = Province.objects.create(name='Bujumbura Mairie')
        commune = Commune.objects.create(province=province, name='Mukaza')
        own = Zone.objects.create(commune=commune, name='Rohero')
        Quartier.objects.create(zone=own, name='Rohero I')
        other = Zone.objects.create(commune=commune, name='Kiriri')
        Quartier.objects.create(zone=other, name='Kiriri')

    def test_public_record_exposes_address_gps_and_catalog_zones(self):
        data = APIClient().get(f'/api/v1/education/profiles/{self.published.id}/').data
        business = data['business_detail']
        self.assertEqual(business['quartier'], 'Rohero I')
        self.assertEqual(business['commune'], 'Mukaza')
        self.assertEqual(business['latitude'], -3.3822)
        zones = {area['zone'] for area in data['nearby_areas']}
        self.assertIn('Kiriri', zones)
        quartiers = [q for area in data['nearby_areas'] for q in area['quartiers']]
        self.assertIn('Kiriri', quartiers)
        self.assertNotIn('Rohero I', quartiers)

    def test_directory_filters_by_commune_from_the_catalog_names(self):
        rows = APIClient().get('/api/v1/education/profiles/?commune=mukaza').data
        self.assertEqual([r['business_name'] for r in rows], [self.school_b.name])
        self.assertEqual(rows[0]['business_quartier'], 'Rohero I')
        empty = APIClient().get('/api/v1/education/profiles/?commune=ntahangwa').data
        self.assertEqual(list(empty), [])

    def test_staff_without_permission_cannot_edit_the_record(self):
        employee = User.objects.create_user(
            email='secr@edu.test', password='Pass123456!', role='PROFESSIONAL',
        )
        role = BusinessRole.objects.create(business=self.school_b, name='Secrétariat')
        BusinessEmployee.objects.create(
            business=self.school_b, user=employee, role=role, is_active=True,
        )
        client = APIClient()
        client.force_authenticate(employee)
        response = client.patch(
            '/api/v1/education/profiles/my_profile/',
            {'official_name': 'Usurpation'},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403))
        self.published.refresh_from_db()
        self.assertNotEqual(self.published.official_name, 'Usurpation')

    def test_blank_accreditation_date_is_cleared(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        response = client.patch(
            '/api/v1/education/profiles/my_profile/',
            {'accreditation_valid_until': ''},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.published.refresh_from_db()
        self.assertIsNone(self.published.accreditation_valid_until)

    def test_program_accepts_academic_content(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        response = client.post(
            '/api/v1/education/programs/',
            {
                'title': 'Licence en informatique',
                'level': 'LICENCE',
                'semester_organization': '6 semestres',
                'main_subjects': 'Algorithmique, bases de données',
                'admission_conditions': 'Baccalauréat requis',
                'required_documents': [
                    {'label': 'Relevés de notes', 'description': '3 derniers trimestres'},
                ],
                'internship_details': 'Stage de 3 mois en entreprise',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        program = EducationProgram.objects.get(title='Licence en informatique')
        self.assertEqual(program.semester_organization, '6 semestres')
        self.assertEqual(program.required_documents[0]['label'], 'Relevés de notes')

    def test_public_program_detail_exposes_academic_content(self):
        EducationProgram.objects.create(
            business=self.school_b,
            title='Master en droit',
            is_public=True,
            main_subjects='Droit civil, procédure',
            internship_details='Stage en cabinet',
        )
        programs = APIClient().get(
            f'/api/v1/education/profiles/{self.published.id}/public_programs/',
        ).data
        row = next(p for p in programs if p['title'] == 'Master en droit')
        self.assertEqual(row['main_subjects'], 'Droit civil, procédure')
        self.assertEqual(row['internship_details'], 'Stage en cabinet')

    def test_search_follows_faculty_domain_level_and_place(self):
        faculty = EducationUnit.objects.create(
            business=self.school_b, name='Sciences', kind='FACULTY',
        )
        department = EducationUnit.objects.create(
            business=self.school_b, name='Informatique', kind='DEPARTMENT', parent=faculty,
        )
        program = EducationProgram.objects.create(
            business=self.school_b, unit=department, title='Licence en informatique',
            domain='Informatique', level='LICENCE', is_public=True,
        )
        EducationProgram.objects.create(
            business=self.school_b, title='Master en droit', domain='Droit',
            level='MASTER', is_public=True,
        )
        EducationFee.objects.create(
            business=self.school_b, program=program, label='Scolarité',
            amount_bif=450000, academic_year='2026-2027', is_public=True,
        )
        EducationFee.objects.create(
            business=self.school_b, program=program, label='Interne',
            amount_bif=1, is_public=False,
        )

        client = APIClient()
        by_faculty = client.get('/api/v1/education/programs/?faculty=Sciences').data
        self.assertEqual([r['title'] for r in by_faculty], ['Licence en informatique'])
        self.assertEqual(by_faculty[0]['faculty_name'], 'Sciences')
        self.assertEqual(by_faculty[0]['unit_name'], 'Informatique')
        self.assertEqual([f['label'] for f in by_faculty[0]['fees']], ['Scolarité'])

        by_domain = client.get('/api/v1/education/programs/?domain=Informatique&level=LICENCE').data
        self.assertEqual([r['title'] for r in by_domain], ['Licence en informatique'])

        by_place = client.get('/api/v1/education/programs/?q=en%20informatique&province=Gitega').data
        self.assertEqual([r['title'] for r in by_place], ['Licence en informatique'])

        facets = client.get('/api/v1/education/programs/facets/').data
        self.assertIn('Informatique', facets['domains'])
        self.assertIn('Sciences', facets['faculties'])
        self.assertIn('LICENCE', [row['value'] for row in facets['levels']])

    def test_campaign_documents_and_rules_follow_the_year(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        created = client.post('/api/v1/education/campaigns/', {
            'program': str(self.program_public.id),
            'academic_year': '2026-2027',
            'opens_on': '2026-06-01',
            'closes_on': '2026-08-31',
            'late_opens_on': '2026-09-01',
            'late_closes_on': '2026-09-15',
            'contest_name': 'Test d’entrée',
            'contest_date': '2026-09-20',
            'results_date': '2026-09-30',
            'confirmation_start': '2026-10-01',
            'confirmation_end': '2026-10-10',
            'required_diploma': 'Diplôme d’État',
            'prerequisites': 'Mathématiques, français',
            'min_grade': '60 %',
            'extra_conditions': 'Entretien pour les candidats étrangers',
            'regulatory_requirements': 'Agrément de l’établissement pour l’année',
            'required_documents': [
                {'label': 'Relevés de notes', 'description': 'Deux dernières années'},
                {'label': 'Pièce d’identité', 'description': ''},
            ],
            'fee_mode': 'GRATUIT',
        }, format='json')
        self.assertEqual(created.status_code, 201, created.content)
        same_program_other_year = client.post('/api/v1/education/campaigns/', {
            'program': str(self.program_public.id),
            'academic_year': '2027-2028',
            'opens_on': '2027-06-01',
            'closes_on': '2027-08-31',
            'required_documents': [{'label': 'Attestation', 'description': ''}],
            'fee_mode': 'GRATUIT',
        }, format='json')
        self.assertEqual(same_program_other_year.status_code, 201, same_program_other_year.content)

        public = APIClient().get(
            f'/api/v1/education/programs/?q=Licence%20Informatique',
        ).data
        row = next(item for item in public if item['title'] == 'Licence Informatique')
        years = {c['academic_year']: c for c in row['campaigns']}
        self.assertEqual(years['2026-2027']['required_diploma'], 'Diplôme d’État')
        self.assertEqual(years['2026-2027']['contest_name'], 'Test d’entrée')
        self.assertEqual(
            [d['label'] for d in years['2026-2027']['required_documents']],
            ['Relevés de notes', 'Pièce d’identité'],
        )
        self.assertEqual(
            [d['label'] for d in years['2027-2028']['required_documents']],
            ['Attestation'],
        )
        filtered = APIClient().get(
            f'/api/v1/education/campaigns/?program={self.program_public.id}&academic_year=2027-2028',
        ).data
        self.assertEqual([c['academic_year'] for c in filtered], ['2027-2028'])


class ModuleWiringTests(EducationBaseTests):
    def test_category_module_drives_the_module(self):
        self.assertTrue(is_education_business(self.school_a))
        self.assertTrue(is_education_business(self.school_b))
        self.assertFalse(is_education_business(self.shop))

    def test_child_without_module_falls_back_to_parent(self):
        orphan_child = BusinessCategory.objects.create(
            name='Cours du soir', slug='cours-du-soir', parent=self.parent, module='',
        )
        business = Business.objects.create(
            owner=self.owner, primary_category=orphan_child, category=orphan_child,
            name='Cours X', email='x@edu.test',
        )
        self.assertTrue(is_education_business(business))

    def test_owner_of_several_businesses_is_not_blocked_by_ordering(self):
        """`get_user_tenant_business` renvoie un seul établissement (`.first()`).

        Un propriétaire d'un établissement Éducation *et* d'une autre activité ne
        doit pas se voir refuser l'Éducation selon l'ordre de la base.
        """
        mixed = User.objects.create_user(
            email='mixte@edu.test', password='Pass123456!', role='BUSINESS_OWNER',
        )
        Business.objects.create(
            owner=mixed, primary_category=self.other_category, category=self.other_category,
            name='Commerce du meme compte', email='commerce-mixte@edu.test',
        )
        Business.objects.create(
            owner=mixed, primary_category=self.child, category=self.child,
            name='Ecole du meme compte', email='ecole-mixte@edu.test',
        )
        client = APIClient()
        client.force_authenticate(mixed)
        response = client.post(
            '/api/v1/education/programs/', {'title': 'Licence mixte'}, format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)

    def test_permission_expansion(self):
        expanded = expand_education_permissions([PROGRAMS_MANAGE])
        self.assertIn('education.programs.create', expanded)
        self.assertIn('education.programs.update', expanded)
        self.assertNotIn('education.fees.manage', expanded)
        self.assertIn('education.fees.manage', expand_education_permissions(['*']))

    def test_employee_with_role_manages_only_own_school(self):
        staff = User.objects.create_user(
            email='scolarite@edu.test', password='Pass123456!', role='PROFESSIONAL',
        )
        role = BusinessRole.objects.create(business=self.school_a, name='Scolarité')
        role.permissions = [PROGRAMS_MANAGE]
        role.save(update_fields=['permissions'])
        BusinessEmployee.objects.create(user=staff, business=self.school_a, role=role)

        client = APIClient()
        client.force_authenticate(staff)
        self.assertEqual(
            client.get('/api/v1/education/programs/').status_code, 200,
        )
        # programs/ en écriture liste le tenant, pas celui de B
        response = client.patch(
            f'/api/v1/education/programs/{self.program_public.id}/',
            {'title': 'Detournage'}, format='json',
        )
        self.assertEqual(response.status_code, 404, response.content)

    def test_employee_without_permission_cannot_write(self):
        staff = User.objects.create_user(
            email='agent@edu.test', password='Pass123456!', role='PROFESSIONAL',
        )
        role = BusinessRole.objects.create(business=self.school_a, name='Agent')
        role.permissions = []
        role.save(update_fields=['permissions'])
        BusinessEmployee.objects.create(user=staff, business=self.school_a, role=role)

        client = APIClient()
        client.force_authenticate(staff)
        response = client.post(
            '/api/v1/education/programs/',
            {'title': 'Programme interdit', 'business': str(self.school_a.id)},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403), response.content)
        self.assertFalse(EducationProgram.objects.filter(title='Programme interdit').exists())


class PublicVisibilityTests(EducationBaseTests):
    def test_visitor_does_not_see_a_draft(self):
        response = APIClient().get('/api/v1/education/profiles/')
        self.assertEqual(response.status_code, 200)
        names = [row['business_name'] for row in response.data]
        self.assertNotIn('Université A', names)
        self.assertIn('Université B', names)

    def test_visitor_cannot_open_a_draft_by_id(self):
        response = APIClient().get(f'/api/v1/education/profiles/{self.draft.id}/')
        self.assertEqual(response.status_code, 404)

    def test_public_programs_exclude_non_public(self):
        response = APIClient().get('/api/v1/education/programs/')
        titles = [row['title'] for row in response.data]
        self.assertIn('Licence Informatique', titles)
        self.assertNotIn('Master Secret', titles)

    def test_visitor_cannot_write(self):
        for url in ('/api/v1/education/profiles/', '/api/v1/education/programs/',
                    '/api/v1/education/units/'):
            response = APIClient().post(url, {'name': 'X', 'title': 'X'}, format='json')
            self.assertIn(response.status_code, (401, 403), (url, response.content))

    def test_non_education_business_is_rejected(self):
        client = APIClient()
        client.force_authenticate(self.shop_owner)
        response = client.get('/api/v1/education/profiles/my_profile/')
        self.assertEqual(response.status_code, 404, response.content)


class TenantIsolationTests(EducationBaseTests):
    def test_staff_list_never_exposes_a_foreign_draft(self):
        """`/profiles/` est l'annuaire public : B y figure car sa fiche est
        publiée. Ce qui ne doit jamais fuiter, c'est le brouillon d'un autre —
       connecté ou non."""
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.get('/api/v1/education/profiles/')
        self.assertEqual(response.status_code, 200)
        ids = [row['id'] for row in response.data]
        self.assertIn(str(self.published.id), ids)
        self.assertNotIn(str(self.draft.id), ids)

    def test_my_profile_returns_only_the_tenant_own_draft(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.get('/api/v1/education/profiles/my_profile/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['id'], str(self.draft.id))

    def test_school_a_cannot_patch_school_b_published_profile(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.patch(
            f'/api/v1/education/profiles/{self.published.id}/',
            {'short_description': 'Detourne'}, format='json',
        )
        self.assertEqual(response.status_code, 404, response.content)
        self.published.refresh_from_db()
        self.assertEqual(self.published.short_description, 'Publiee')

    def test_school_a_cannot_delete_school_b_unit(self):
        unit_b = EducationUnit.objects.create(business=self.school_b, name='Faculté B')
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.delete(f'/api/v1/education/units/{unit_b.id}/')
        self.assertIn(response.status_code, (403, 404), response.content)
        self.assertTrue(EducationUnit.objects.filter(id=unit_b.id).exists())

    def test_cannot_attach_program_to_foreign_unit(self):
        unit_b = EducationUnit.objects.create(business=self.school_b, name='Faculté B')
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.post(
            '/api/v1/education/programs/',
            {'title': 'Formation injectée', 'unit': str(unit_b.id), 'level': 'LICENCE'},
            format='json',
        )
        self.assertIn(response.status_code, (400, 403), response.content)
        self.assertFalse(EducationProgram.objects.filter(title='Formation injectée').exists())


class PlatformAdminGuardTests(EducationBaseTests):
    def test_super_admin_sees_only_the_public_directory(self):
        """L'annuaire public reste public. Ce qui est refusé, c'est le perimetre
        de gestion : le super admin n'est pas un etablissement."""
        anonymous = APIClient()
        client = APIClient()
        client.force_authenticate(self.super_admin)
        for url in ('/api/v1/education/profiles/', '/api/v1/education/programs/',
                    '/api/v1/education/units/'):
            expected = anonymous.get(url).data
            response = client.get(url)
            self.assertEqual(response.status_code, 200, url)
            self.assertEqual(list(response.data), list(expected), url)

    def test_super_admin_has_no_tenant_dashboard(self):
        client = APIClient()
        client.force_authenticate(self.super_admin)
        response = client.get('/api/v1/education/profiles/my_profile/')
        self.assertEqual(response.status_code, 404, response.content)

    def test_super_admin_cannot_write(self):
        client = APIClient()
        client.force_authenticate(self.super_admin)
        response = client.post(
            '/api/v1/education/programs/', {'title': 'Programme admin'}, format='json',
        )
        self.assertIn(response.status_code, (401, 403), response.content)
        self.assertFalse(EducationProgram.objects.filter(title='Programme admin').exists())


class PlatformApprovalPublishesProfileTests(EducationBaseTests):
    """Approuver l'inscription doit rendre l'école visible côté client.

    L'annuaire public est filtré sur `EducationProfile`, pas sur `Business` :
    sans ce raccordement dans `AdminModerationApproveView`, une école approuvée
    restait invisible — c'est exactement le bug rencontré en production.
    """

    def test_approved_business_without_profile_is_invisible_before_approval(self):
        fresh = Business.objects.create(
            owner=self.owner_b, primary_category=self.child, category=self.child,
            name='Ecole en attente', email='attente@edu.test',
            verification_status='PENDING', is_verified=False,
        )
        names = [row['business_name'] for row in APIClient().get('/api/v1/education/profiles/').data]
        self.assertNotIn('Ecole en attente', names)
        self.assertFalse(hasattr(fresh, 'education_profile'))

    def test_platform_approval_creates_and_publishes_the_profile(self):
        pending = Business.objects.create(
            owner=self.owner_b, primary_category=self.child, category=self.child,
            name='Ecole validee', email='validee@edu.test',
            verification_status='PENDING', is_verified=False,
        )

        client = APIClient()
        client.force_authenticate(self.super_admin)
        response = client.post(
            f'/api/v1/businesses/admin/moderation/{pending.id}/approve/',
            {}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        profile = EducationProfile.objects.get(business=pending)
        self.assertEqual(profile.publication_status, PublicationStatus.PUBLISHED)
        self.assertIsNotNone(profile.published_at)

        names = [row['business_name'] for row in APIClient().get('/api/v1/education/profiles/').data]
        self.assertIn('Ecole validee', names)

    def test_approval_does_not_touch_other_modules(self):
        client = APIClient()
        client.force_authenticate(self.super_admin)
        response = client.post(
            f'/api/v1/businesses/admin/moderation/{self.shop.id}/approve/',
            {}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(EducationProfile.objects.filter(business=self.shop).exists())

    def test_approval_is_idempotent(self):
        from education.moderation import publish_education_profile

        self.published.refresh_from_db()
        first_seen = self.published.published_at
        again = publish_education_profile(self.published.business)
        self.published.refresh_from_db()
        self.assertEqual(again.publication_status, PublicationStatus.PUBLISHED)
        # La date de publication ne doit pas bouger à chaque ré-approbation.
        self.assertEqual(self.published.published_at, first_seen)

    def test_publish_helper_ignores_non_education(self):
        from education.moderation import publish_education_profile

        self.assertIsNone(publish_education_profile(self.shop))

    def test_registration_choice_is_copied_onto_the_school_profile(self):
        from education.school_tracks import apply_registration_tracks, school_track_errors
        school_category = BusinessCategory.objects.create(
            name='École', slug='ecole', parent=self.parent, module=ModuleKey.EDUCATION,
        )
        missing = school_track_errors(school_category, {'extra_attributes': {}})
        self.assertTrue(missing)
        business = Business.objects.create(
            owner=self.owner, primary_category=school_category, category=school_category,
            name='ECOFO et lycée', email='lycee@edu.test',
            extra_attributes={'school_tracks': {
                'offers_ecofo': True,
                'offers_post_fondamental': True,
                'ecofo_cycles': ['C1', 'C2'],
                'post_fondamental_sections': [
                    {'orientation': 'GENERAL', 'name': 'Sciences'},
                    {'orientation': 'TECHNIQUE', 'name': 'Informatique'},
                ],
            }},
        )
        apply_registration_tracks(business)
        profile = EducationProfile.objects.get(business=business)
        self.assertTrue(profile.offers_ecofo)
        self.assertTrue(profile.offers_post_fondamental)
        self.assertEqual(profile.ecofo_cycles, ['C1', 'C2'])
        self.assertEqual([item['name'] for item in profile.post_fondamental_sections], ['Sciences', 'Informatique'])

    def test_school_opens_a_year_without_a_program(self):
        from django.utils import timezone
        school_category = BusinessCategory.objects.create(
            name='École cycle', slug='ecole', parent=self.parent, module=ModuleKey.EDUCATION,
        )
        school_owner = User.objects.create_user(
            email='ecole-annee@edu.test', password='Pass123456!', role='BUSINESS_OWNER',
        )
        business = Business.objects.create(
            owner=school_owner, primary_category=school_category, category=school_category,
            name='École du quartier', email='quartier@edu.test',
        )
        EducationProfile.objects.create(
            business=business, publication_status=PublicationStatus.PUBLISHED,
            published_at=timezone.now(),
            offers_prescolaire=True,
            offers_ecofo=True,
            offers_post_fondamental=True,
            ecofo_cycles=['C1'],
            ecofo_classes=[{'value': '1', 'label': '1ère année'}, {'value': '2', 'label': '2ème année'}],
            post_fondamental_sections=[{
                'orientation': 'GENERAL',
                'name': 'Sciences',
                'classes': [{'value': '1', 'label': '1ère année'}, {'value': '2', 'label': '2ème année'}],
                'years': ['1', '2'],
            }],
        )
        client = APIClient()
        client.force_authenticate(school_owner)
        response = client.post('/api/v1/education/campaigns/', {
            'academic_year': '2026-2027',
            'opens_on': '2026-06-01',
            'closes_on': '2026-09-01',
            'enrollment_plan': [
                {'track': 'PRESCOLAIRE', 'year': '', 'section': '', 'seats': 40},
                {'track': 'ECOFO', 'year': '1', 'section': '', 'seats': 50},
                {'track': 'POST_FONDAMENTAL', 'year': '1', 'section': 'Sciences', 'seats': 30},
            ],
            'fee_label': 'Frais d’inscription',
            'fee_amount_bif': 15000,
            'required_documents': [{'label': 'Photo d’identité', 'description': ''}],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIsNone(response.data['program'])
        self.assertIn('2026-2027', response.data['program_title'])
        self.assertEqual(
            set(response.data['open_tracks']),
            {'PRESCOLAIRE', 'ECOFO', 'POST_FONDAMENTAL'},
        )
        self.assertEqual(len(response.data['enrollment_plan']), 3)
        self.assertEqual(response.data['enrollment_fee']['amount_bif'], 15000)
        self.assertEqual(response.data['enrollment_fee']['fee_mode'], 'PAYANT')
        same_year_free = client.post('/api/v1/education/campaigns/', {
            'academic_year': '2026-2027',
            'opens_on': '2026-06-01',
            'closes_on': '2026-09-01',
            'enrollment_plan': [
                {'track': 'PRESCOLAIRE', 'year': '', 'section': '', 'seats': 10},
            ],
            'fee_mode': 'GRATUIT',
        }, format='json')
        self.assertEqual(same_year_free.status_code, 201, same_year_free.content)
        self.assertEqual(same_year_free.data['enrollment_fee']['fee_mode'], 'GRATUIT')
        self.assertEqual(same_year_free.data['enrollment_fee']['amount_bif'], 0)
        self.assertNotEqual(same_year_free.data['enrollment_fee']['id'], response.data['enrollment_fee']['id'])
        duplicate_paid = client.post('/api/v1/education/campaigns/', {
            'academic_year': '2026-2027',
            'opens_on': '2026-06-01',
            'closes_on': '2026-09-01',
            'enrollment_plan': [
                {'track': 'PRESCOLAIRE', 'year': '', 'section': '', 'seats': 10},
            ],
            'fee_mode': 'PAYANT',
            'fee_amount_bif': 10000,
        }, format='json')
        self.assertEqual(duplicate_paid.status_code, 400, duplicate_paid.content)
        free = client.post('/api/v1/education/campaigns/', {
            'academic_year': '2027-2028',
            'opens_on': '2027-06-01',
            'closes_on': '2027-09-01',
            'enrollment_plan': [
                {'track': 'PRESCOLAIRE', 'year': '', 'section': '', 'seats': 40},
            ],
            'fee_mode': 'GRATUIT',
            'fee_amount_bif': 15000,
        }, format='json')
        self.assertEqual(free.status_code, 201, free.content)
        self.assertEqual(free.data['enrollment_fee']['fee_mode'], 'GRATUIT')
        self.assertEqual(free.data['enrollment_fee']['amount_bif'], 0)
        refused = client.post('/api/v1/education/campaigns/', {
            'academic_year': '2028-2029',
            'opens_on': '2028-06-01',
            'closes_on': '2028-09-01',
            'enrollment_plan': [
                {'track': 'PRESCOLAIRE', 'year': '', 'section': '', 'seats': 40},
            ],
            'fee_mode': 'PAYANT',
            'fee_amount_bif': 0,
        }, format='json')
        self.assertEqual(refused.status_code, 400, refused.content)
        self.assertIn('PRESCOLAIRE', response.data['documents_by_track'])
        self.assertEqual(
            [doc['label'] for doc in response.data['documents_by_track']['PRESCOLAIRE']['documents']],
            ['Photo passeport', "Extrait d'acte de naissance", 'Photo d’identité'],
        )

        updated = client.patch(f"/api/v1/education/campaigns/{response.data['id']}/", {
            'closes_on': '2026-09-15',
            'fee_amount_bif': 20000,
            'fee_label': 'Frais d’inscription',
            'enrollment_plan': response.data['enrollment_plan'],
        }, format='json')
        self.assertEqual(updated.status_code, 200, updated.content)
        self.assertEqual(updated.data['closes_on'], '2026-09-15')
        self.assertEqual(updated.data['enrollment_fee']['amount_bif'], 20000)

        hidden = client.patch(f"/api/v1/education/campaigns/{response.data['id']}/", {
            'is_public': False,
        }, format='json')
        self.assertEqual(hidden.status_code, 200, hidden.content)
        self.assertFalse(hidden.data['is_public'])
        self.assertEqual(
            APIClient().get(f"/api/v1/education/campaigns/{response.data['id']}/").status_code,
            404,
        )
        shown = client.patch(f"/api/v1/education/campaigns/{response.data['id']}/", {
            'is_public': True,
        }, format='json')
        self.assertEqual(shown.status_code, 200, shown.content)
        self.assertTrue(shown.data['is_public'])

        from education.models import EnrollmentApplication
        EnrollmentApplication.objects.create(
            business=business,
            campaign_id=response.data['id'],
            student_name='Élève à retirer',
            student_email='retire@edu.test',
            student_phone='79001122',
            track='PRESCOLAIRE',
            status='ENVOYEE',
        )
        deleted = client.delete(f"/api/v1/education/campaigns/{response.data['id']}/")
        self.assertEqual(deleted.status_code, 204, deleted.content)
        deleted_same = client.delete(f"/api/v1/education/campaigns/{same_year_free.data['id']}/")
        self.assertEqual(deleted_same.status_code, 204, deleted_same.content)
        deleted_free = client.delete(f"/api/v1/education/campaigns/{free.data['id']}/")
        self.assertEqual(deleted_free.status_code, 204, deleted_free.content)
        self.assertFalse(
            client.get('/api/v1/education/campaigns/?mine=1').data,
        )

    def test_school_application_documents_depend_on_track(self):
        from datetime import date, timedelta
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.utils import timezone

        school_category = BusinessCategory.objects.create(
            name='École docs', slug='ecole', parent=self.parent, module=ModuleKey.EDUCATION,
        )
        school_owner = User.objects.create_user(
            email='ecole-docs@edu.test', password='Pass123456!', role='BUSINESS_OWNER',
        )
        business = Business.objects.create(
            owner=school_owner, primary_category=school_category, category=school_category,
            name='École documents', email='docs@edu.test',
        )
        EducationProfile.objects.create(
            business=business, publication_status=PublicationStatus.PUBLISHED,
            published_at=timezone.now(),
            offers_prescolaire=True,
            offers_ecofo=True,
            offers_post_fondamental=True,
            ecofo_cycles=['C1'],
            ecofo_classes=[
                {'value': '1', 'label': '1ère année'},
                {'value': '2', 'label': '2ème année'},
            ],
            post_fondamental_sections=[{
                'orientation': 'GENERAL',
                'name': 'Lettres',
                'classes': [
                    {'value': '1', 'label': '1ère année'},
                    {'value': '2', 'label': '2ème année'},
                    {'value': '3', 'label': '3ème année'},
                ],
                'years': ['1', '2', '3'],
            }],
        )
        today = date.today()
        owner = APIClient()
        owner.force_authenticate(school_owner)
        campaign = owner.post('/api/v1/education/campaigns/', {
            'academic_year': '2027-2028',
            'opens_on': str(today - timedelta(days=1)),
            'closes_on': str(today + timedelta(days=20)),
            'enrollment_plan': [
                {'track': 'PRESCOLAIRE', 'year': '', 'section': '', 'seats': 20},
                {'track': 'ECOFO', 'year': '1', 'section': '', 'seats': 40},
                {'track': 'ECOFO', 'year': '2', 'section': '', 'seats': 40},
                {'track': 'POST_FONDAMENTAL', 'year': '1', 'section': 'Lettres', 'seats': 25},
                {'track': 'POST_FONDAMENTAL', 'year': '2', 'section': 'Lettres', 'seats': 25},
                {'track': 'POST_FONDAMENTAL', 'year': '3', 'section': 'Lettres', 'seats': 25},
            ],
            'fee_amount_bif': 0,
            'fee_label': 'Frais d’inscription',
        }, format='json')
        self.assertEqual(campaign.status_code, 201, campaign.content)
        campaign_id = campaign.data['id']

        def apply(client, **extra):
            payload = {
                'campaign': campaign_id,
                'student_name': 'Élève Test',
                'student_email': extra.pop('email', 'eleve@edu.test'),
                'student_phone': '79001122',
                'birth_date': '2018-03-12',
                'gender': 'F',
                'guardian_name': 'Parent Test',
                'guardian_phone': '79003344',
                'guardian_link': 'Mère',
                **extra,
            }
            labels = payload.pop('labels', [])
            if not any(str(label).lower() == 'photo passeport' for label in labels):
                labels = ['Photo passeport', *labels]
            for index, label in enumerate(labels):
                photo = str(label).lower() == 'photo passeport'
                payload[f'doc_label_{index}'] = label
                payload[f'doc_file_{index}'] = SimpleUploadedFile(
                    'passeport.jpg' if photo else f'{label}.pdf',
                    b'\xff\xd8\xff\xd8' if photo else b'%PDF-1.4 piece',
                    content_type='image/jpeg' if photo else 'application/pdf',
                )
            return client.post(
                '/api/v1/education/applications/apply/',
                payload,
                format='multipart',
            )

        anon = APIClient()
        missing = apply(anon, track='')
        self.assertEqual(missing.status_code, 400, missing.content)

        preschool = apply(
            anon,
            email='maternelle@edu.test',
            track='PRESCOLAIRE',
            labels=["Extrait d'acte de naissance"],
        )
        self.assertEqual(preschool.status_code, 201, preschool.content)
        self.assertEqual(preschool.data['application']['status'], 'LISTE_ATTENTE')
        self.assertEqual(
            [doc['label'] for doc in preschool.data['application']['required_documents']],
            ['Photo passeport', "Extrait d'acte de naissance"],
        )

        again = apply(
            anon,
            email='maternelle@edu.test',
            track='ECOFO',
            ecofo_year='1',
            labels=[
                "Extrait d'acte de naissance", 'Bulletin',
                'Attestation de fréquentation', 'Attestation de non-redevabilité',
            ],
        )
        self.assertEqual(again.status_code, 200, again.content)
        self.assertTrue(again.data.get('already_exists'))

        ecofo = apply(
            anon,
            email='ecofo1@edu.test',
            track='ECOFO',
            ecofo_year='1',
            labels=["Extrait d'acte de naissance"],
        )
        self.assertEqual(ecofo.status_code, 201, ecofo.content)
        self.assertEqual(
            [doc['label'] for doc in ecofo.data['application']['required_documents']],
            ['Photo passeport', "Extrait d'acte de naissance"],
        )

        post = apply(
            anon,
            email='post@edu.test',
            track='POST_FONDAMENTAL',
            post_section='Lettres',
            post_year='1',
            labels=["Extrait d'acte de naissance"],
        )
        self.assertEqual(post.status_code, 201, post.content)
        self.assertEqual(
            [doc['label'] for doc in post.data['application']['required_documents']],
            ['Photo passeport', "Extrait d'acte de naissance"],
        )

        patched = owner.patch(f'/api/v1/education/campaigns/{campaign_id}/', {
            'extra_criteria': [{
                'kind': 'TEST',
                'label': 'Test de sélection',
                'date': '2026-08-20',
                'place': 'Salle 2',
                'details': 'Français et mathématiques',
            }],
        }, format='json')
        self.assertEqual(patched.status_code, 200, patched.content)
        self.assertEqual(patched.data['extra_criteria'][0]['kind'], 'TEST')

        missing_ack = apply(
            anon,
            email='crit-non@edu.test',
            track='PRESCOLAIRE',
            labels=["Extrait d'acte de naissance"],
        )
        self.assertEqual(missing_ack.status_code, 400, missing_ack.content)

        with_ack = apply(
            anon,
            email='crit-oui@edu.test',
            track='PRESCOLAIRE',
            labels=["Extrait d'acte de naissance"],
            criteria_ack='1',
        )
        self.assertEqual(with_ack.status_code, 201, with_ack.content)
        self.assertTrue(with_ack.data['application']['criteria_acknowledged'])

        suivi_url = with_ack.data['application']['suivi_url']
        self.assertIn('/education/dossier?token=', suivi_url)
        token = suivi_url.split('token=', 1)[1]
        tracked = anon.get(f'/api/v1/education/applications/suivi/?token={token}')
        self.assertEqual(tracked.status_code, 200, tracked.content)
        self.assertEqual(tracked.data['status'], 'LISTE_ATTENTE')
        self.assertEqual(anon.get('/api/v1/education/applications/suivi/?token=nope').status_code, 404)

        app_id = with_ack.data['application']['id']
        messages = owner.patch(
            '/api/v1/education/profiles/message-settings/',
            {'accepted_message': 'Bonjour {student_name}, inscription confirmée. Motif : {note}'},
            format='json',
        )
        self.assertEqual(messages.status_code, 200, messages.content)
        self.assertIn('{note}', messages.data['accepted_message'])
        asked = owner.post(
            f'/api/v1/education/applications/{app_id}/decide/',
            {'status': 'ACCEPTEE'},
            format='json',
        )
        self.assertEqual(asked.status_code, 200, asked.content)
        self.assertEqual(asked.data['status'], 'ACCEPTEE')

        mine = owner.get('/api/v1/education/campaigns/?mine=1')
        year = next(item for item in mine.data if str(item['id']) == str(campaign_id))
        preschool = next(slot for slot in year['seat_summary'] if slot['track'] == 'PRESCOLAIRE')
        self.assertGreaterEqual(preschool['waiting'], 1)
        self.assertEqual(preschool['held'], preschool['accepted'])
        self.assertEqual(preschool['remaining'], preschool['seats'] - preschool['held'])

        again = apply(
            anon,
            email='crit-oui@edu.test',
            track='PRESCOLAIRE',
            labels=["Extrait d'acte de naissance"],
            criteria_ack='1',
        )
        self.assertEqual(again.status_code, 200, again.content)
        self.assertTrue(again.data.get('already_exists'))
        self.assertIn('/education/dossier?token=', again.data['application']['suivi_url'])

        tight = owner.post('/api/v1/education/campaigns/', {
            'academic_year': '2028-2029',
            'opens_on': str(today - timedelta(days=1)),
            'closes_on': str(today + timedelta(days=20)),
            'enrollment_plan': [
                {'track': 'ECOFO', 'year': '1', 'section': '', 'seats': 1},
            ],
            'fee_amount_bif': 0,
            'fee_label': 'Frais d’inscription',
        }, format='json')
        self.assertEqual(tight.status_code, 201, tight.content)
        seated = apply(
            anon,
            email='place@edu.test',
            campaign=tight.data['id'],
            track='ECOFO',
            ecofo_year='1',
            labels=["Extrait d'acte de naissance"],
        )
        self.assertEqual(seated.status_code, 201, seated.content)
        self.assertEqual(seated.data['application']['status'], 'LISTE_ATTENTE')
        accepted = owner.post(
            f"/api/v1/education/applications/{seated.data['application']['id']}/decide/",
            {'status': 'ACCEPTEE', 'note': 'Place accordée'},
            format='json',
        )
        self.assertEqual(accepted.status_code, 200, accepted.content)
        waiting = apply(
            anon,
            email='attente@edu.test',
            campaign=tight.data['id'],
            track='ECOFO',
            ecofo_year='1',
            labels=["Extrait d'acte de naissance"],
        )
        self.assertEqual(waiting.status_code, 201, waiting.content)
        self.assertEqual(waiting.data['application']['status'], 'LISTE_ATTENTE')
        self.assertEqual(waiting.data['application']['guardian_name'], 'Parent Test')
        blocked = owner.post(
            f"/api/v1/education/applications/{waiting.data['application']['id']}/decide/",
            {'status': 'ACCEPTEE', 'note': 'Classe déjà complète'},
            format='json',
        )
        self.assertEqual(blocked.status_code, 400, blocked.content)

    def test_school_defines_documents_per_class_and_client_sends_them(self):
        """L'école nomme les pièces de chaque classe. L'élève dépose celles de sa classe."""
        from datetime import date, timedelta
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.utils import timezone

        school_category = BusinessCategory.objects.create(
            name='École pièces', slug='ecole', parent=self.parent, module=ModuleKey.EDUCATION,
        )
        school_owner = User.objects.create_user(
            email='ecole-pieces@edu.test', password='Pass123456!', role='BUSINESS_OWNER',
        )
        business = Business.objects.create(
            owner=school_owner, primary_category=school_category, category=school_category,
            name='École des pièces', email='pieces@edu.test',
        )
        EducationProfile.objects.create(
            business=business, publication_status=PublicationStatus.PUBLISHED,
            published_at=timezone.now(),
            offers_prescolaire=True,
            offers_ecofo=True,
            offers_post_fondamental=True,
            ecofo_cycles=['C1'],
            ecofo_classes=[{'value': '1', 'label': '1ère année'}],
            post_fondamental_sections=[{
                'orientation': 'GENERAL',
                'name': 'Lettres',
                'classes': [{'value': '1', 'label': '1ère année'}],
                'years': ['1'],
            }],
        )
        today = date.today()
        admin = APIClient()
        admin.force_authenticate(school_owner)
        opened = admin.post('/api/v1/education/campaigns/', {
            'academic_year': '2026-2027',
            'opens_on': str(today - timedelta(days=1)),
            'closes_on': str(today + timedelta(days=20)),
            'fee_mode': 'GRATUIT',
            'enrollment_plan': [
                {
                    'track': 'PRESCOLAIRE', 'year': '', 'section': '', 'seats': 20,
                    'documents': [{'label': 'Carnet de vaccination', 'description': 'PDF'}],
                },
                {
                    'track': 'ECOFO', 'year': '1', 'section': '', 'seats': 30,
                    'documents': [{'label': 'Bulletin de 6e', 'description': ''}],
                },
                {
                    'track': 'POST_FONDAMENTAL', 'year': '1', 'section': 'Lettres', 'seats': 25,
                    'documents': [
                        {'label': 'Relevé du tronc commun', 'description': ''},
                        {'label': 'Photo récente', 'description': ''},
                    ],
                },
            ],
        }, format='json')
        self.assertEqual(opened.status_code, 201, opened.content)
        by_track = {row['track']: row for row in opened.data['enrollment_plan']}
        self.assertEqual(by_track['PRESCOLAIRE']['documents'][0]['label'], 'Carnet de vaccination')
        self.assertEqual(
            [doc['label'] for doc in opened.data['documents_by_track']['ECOFO']['years'][0]['documents']],
            ['Photo passeport', 'Bulletin de 6e'],
        )
        post_year = opened.data['documents_by_track']['POST_FONDAMENTAL']['sections'][0]['years'][0]
        self.assertEqual(
            [doc['label'] for doc in post_year['documents']],
            ['Photo passeport', 'Relevé du tronc commun', 'Photo récente'],
        )
        self.assertNotIn("Extrait d'acte de naissance", str(opened.data['documents_by_track']))

        visitor = APIClient()
        public = visitor.get(f"/api/v1/education/campaigns/{opened.data['id']}/")
        self.assertEqual(public.status_code, 200, public.content)
        self.assertEqual(
            [doc['label'] for doc in public.data['documents_by_track']['PRESCOLAIRE']['documents'][:2]],
            ['Photo passeport', 'Carnet de vaccination'],
        )

        def apply(email, labels, **extra):
            payload = {
                'campaign': opened.data['id'],
                'student_name': 'Élève Pièces',
                'student_email': email,
                'student_phone': '79001122',
                'birth_date': '2016-04-02',
                'gender': 'M',
                'guardian_name': 'Parent Pièces',
                'guardian_phone': '79003344',
                'guardian_link': 'Père',
                **extra,
            }
            for index, label in enumerate(labels):
                payload[f'doc_label_{index}'] = label
                photo = str(label).lower() == 'photo passeport'
                payload[f'doc_file_{index}'] = SimpleUploadedFile(
                    'passeport.jpg' if photo else 'piece.pdf',
                    b'\xff\xd8\xff\xd8' if photo else b'%PDF-1.4 piece',
                    content_type='image/jpeg' if photo else 'application/pdf',
                )
            return visitor.post('/api/v1/education/applications/apply/', payload, format='multipart')

        wrong = apply('mauvais@edu.test', ['Photo passeport', "Extrait d'acte de naissance"], track='ECOFO', ecofo_year='1')
        self.assertEqual(wrong.status_code, 400, wrong.content)
        self.assertIn('Bulletin de 6e', str(wrong.data))

        sent = apply('ecofo-pieces@edu.test', ['Photo passeport', 'Bulletin de 6e'], track='ECOFO', ecofo_year='1')
        self.assertEqual(sent.status_code, 201, sent.content)
        self.assertEqual(
            [doc['label'] for doc in sent.data['application']['required_documents']],
            ['Photo passeport', 'Bulletin de 6e'],
        )
        post = apply(
            'post-pieces@edu.test',
            ['Photo passeport', 'Relevé du tronc commun', 'Photo récente'],
            track='POST_FONDAMENTAL', post_section='Lettres', post_year='1',
        )
        self.assertEqual(post.status_code, 201, post.content)

        dossiers = admin.get('/api/v1/education/applications/')
        emails = {row['student_email'] for row in dossiers.data}
        self.assertIn('ecofo-pieces@edu.test', emails)
        self.assertIn('post-pieces@edu.test', emails)


class PublicationFlowTests(EducationBaseTests):
    def test_owner_submits_then_publishes_through_mark_published(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.post('/api/v1/education/profiles/submit-for-review/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['publication_status'], PublicationStatus.SUBMITTED)

        self.draft.publication_status = PublicationStatus.PUBLISHED
        self.draft.save()
        listing = APIClient().get('/api/v1/education/profiles/')
        self.assertIn('Université A', [row['business_name'] for row in listing.data])

    def test_publication_status_is_not_client_writable(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.patch(
            f'/api/v1/education/profiles/{self.draft.id}/',
            {'publication_status': 'PUBLISHED', 'short_description': 'Auto-publish'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.publication_status, PublicationStatus.DRAFT)
        self.assertEqual(self.draft.short_description, 'Auto-publish')

    def test_structure_permission_required_for_units(self):
        staff = User.objects.create_user(
            email='doyen@edu.test', password='Pass123456!', role='PROFESSIONAL',
        )
        role = BusinessRole.objects.create(business=self.school_a, name='Doyen')
        role.permissions = [STRUCTURE_MANAGE]
        role.save(update_fields=['permissions'])
        BusinessEmployee.objects.create(user=staff, business=self.school_a, role=role)

        client = APIClient()
        client.force_authenticate(staff)
        response = client.post(
            '/api/v1/education/units/', {'name': 'Faculté des sciences'}, format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)


class EnrollmentAndFeeTests(EducationBaseTests):
    def _campaign(self, program, year='2026-2027', opens=None, closes=None):
        from datetime import date, timedelta
        today = date.today()
        client = APIClient()
        client.force_authenticate(self.owner_b)
        response = client.post('/api/v1/education/campaigns/', {
            'program': str(program.id),
            'academic_year': year,
            'opens_on': str(opens or (today - timedelta(days=1))),
            'closes_on': str(closes or (today + timedelta(days=10))),
            'fee_mode': 'GRATUIT',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        return response.data

    def test_application_outside_the_period_is_refused(self):
        from datetime import timedelta
        today = __import__('datetime').date.today()
        closed = self._campaign(
            self.program_public, year='2025-2026',
            opens=today - timedelta(days=30), closes=today - timedelta(days=1),
        )
        response = APIClient().post('/api/v1/education/applications/apply/', {
            'campaign': closed['id'],
            'student_name': 'A',
            'student_email': 'a@edu.test',
            'student_phone': '79001122',
        }, format='multipart')
        self.assertEqual(response.status_code, 400, response.content)

    def test_student_submits_and_other_school_cannot_read(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        opened = self._campaign(self.program_public)
        created = APIClient().post('/api/v1/education/applications/apply/', {
            'campaign': opened['id'],
            'first_name': 'Étudiant',
            'last_name': 'Test',
            'student_email': 'candidat@edu.test',
            'student_phone': '79001122',
            'birth_date': '2004-05-02',
            'gender': 'M',
            'nationality': 'Burundaise',
            'marital_status': 'Célibataire',
            'avenue': 'Avenue',
            'zone': 'Zone',
            'commune': 'Commune',
            'province': 'Gitega',
            'country': 'Burundi',
            'previous_school': 'Lycée',
            'last_percent': '70',
            'state_exam_percent': '65',
            'studies_declared': 'Non',
            'guardian_link': 'Père',
            'guardian_name': 'Parent',
            'guardian_email': 'parent@edu.test',
            'guardian_phone': '79111111',
            'guardian_address': 'Gitega',
            'study_year': 'BAC I',
            'terms_ack': '1',
            'doc_label_0': 'Photo passeport',
            'doc_file_0': SimpleUploadedFile('passeport.jpg', b'\xff\xd8\xff\xd8', content_type='image/jpeg'),
            'doc_label_1': 'Carte d’identité',
            'doc_file_1': SimpleUploadedFile('carte.pdf', b'%PDF-1.4', content_type='application/pdf'),
        }, format='multipart')
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data['application']['status'], 'ENVOYEE')

        other = APIClient()
        other.force_authenticate(self.owner)
        listed = other.get('/api/v1/education/applications/')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data, [])

        school = APIClient()
        school.force_authenticate(self.owner_b)
        mine = school.get('/api/v1/education/applications/')
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(len(mine.data), 1)

    def test_invalid_burundipay_phone_is_rejected_before_payment(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        fee = client.post('/api/v1/education/fees/', {
            'program': str(self.program_public.id),
            'academic_year': '2026-2027',
            'label': 'Inscription',
            'amount_bif': 50000,
            'is_public': True,
        }, format='json')
        self.assertEqual(fee.status_code, 201, fee.content)
        student = APIClient()
        student.force_authenticate(self.student)
        response = student.post(f"/api/v1/education/fees/{fee.data['id']}/pay/", {
            'payer_phone': '12',
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)

    def test_owner_lists_unpublished_programs(self):
        EducationProgram.objects.create(
            business=self.school_b, title='Brouillon secret', is_public=False,
        )
        public = APIClient().get('/api/v1/education/programs/').data
        self.assertNotIn('Brouillon secret', [row['title'] for row in public])
        client = APIClient()
        client.force_authenticate(self.owner_b)
        mine = client.get('/api/v1/education/programs/?mine=1').data
        self.assertIn('Brouillon secret', [row['title'] for row in mine])

    def test_each_required_document_is_uploaded_before_submit(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        opened = self._campaign(self.program_public, year='2028-2029')
        owner = APIClient()
        owner.force_authenticate(self.owner_b)
        patched = owner.patch(
            f"/api/v1/education/campaigns/{opened['id']}/",
            {'required_documents': [
                {'label': 'Diplôme', 'description': ''},
                {'label': 'Relevés', 'description': ''},
            ]},
            format='json',
        )
        self.assertEqual(patched.status_code, 200, patched.content)
        early = APIClient().post('/api/v1/education/applications/apply/', {
            'campaign': opened['id'],
            'student_name': 'Étudiant',
            'student_email': 'docs@edu.test',
            'student_phone': '79001122',
            'doc_label_0': 'Diplôme',
            'doc_file_0': SimpleUploadedFile('d.pdf', b'%PDF-1.4 d', content_type='application/pdf'),
        }, format='multipart')
        self.assertEqual(early.status_code, 400, early.content)
        created = APIClient().post('/api/v1/education/applications/apply/', {
            'campaign': opened['id'],
            'first_name': 'Étudiant',
            'last_name': 'Test',
            'student_email': 'docs@edu.test',
            'student_phone': '79001122',
            'birth_date': '2004-05-02',
            'gender': 'M',
            'nationality': 'Burundaise',
            'marital_status': 'Célibataire',
            'avenue': 'Avenue',
            'zone': 'Zone',
            'commune': 'Commune',
            'province': 'Gitega',
            'country': 'Burundi',
            'previous_school': 'Lycée',
            'last_percent': '70',
            'state_exam_percent': '65',
            'studies_declared': 'Non',
            'guardian_link': 'Père',
            'guardian_name': 'Parent',
            'guardian_email': 'parent@edu.test',
            'guardian_phone': '79111111',
            'guardian_address': 'Gitega',
            'study_year': 'BAC I',
            'terms_ack': '1',
            'doc_label_0': 'Photo passeport',
            'doc_file_0': SimpleUploadedFile('passeport.jpg', b'\xff\xd8\xff\xd8', content_type='image/jpeg'),
            'doc_label_1': 'Carte d’identité',
            'doc_file_1': SimpleUploadedFile('carte.pdf', b'%PDF-1.4 c', content_type='application/pdf'),
            'doc_label_2': 'Diplôme',
            'doc_file_2': SimpleUploadedFile('d.pdf', b'%PDF-1.4 d', content_type='application/pdf'),
            'doc_label_3': 'Relevés',
            'doc_file_3': SimpleUploadedFile('r.pdf', b'%PDF-1.4 r', content_type='application/pdf'),
        }, format='multipart')
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data['application']['status'], 'ENVOYEE')
        self.assertEqual(len(created.data['application']['files']), 4)


class SubscriptionGatingTests(EducationBaseTests):
    """L'abonnement doit couper TOUS les points d'entrée publics, pas seulement
    la fiche.

    Régression : `/programs/` et `/units/` listaient encore les formations d'un
    établissement résilié alors que sa fiche et ses frais étaient déjà masqués.

    `school_b` est l'établissement publié, détenu par `owner_b`.
    """

    def setUp(self):
        super().setUp()
        self.program_public.domain = 'Informatique'
        self.program_public.save(update_fields=['domain'])
        self.unit = EducationUnit.objects.create(
            business=self.school_b, name='Faculté Informatique',
        )
        self.program_public.unit = self.unit
        self.program_public.save(update_fields=['unit'])

    def _expire_subscription(self):
        self.school_b.subscription.status = 'CANCELLED'
        self.school_b.subscription.save(update_fields=['status'])

    def test_units_are_hidden_when_subscription_is_expired(self):
        self.assertEqual(
            [u['name'] for u in APIClient().get('/api/v1/education/units/').data],
            ['Faculté Informatique'],
        )
        self._expire_subscription()
        self.assertEqual(APIClient().get('/api/v1/education/units/').data, [])

    def test_programs_are_hidden_when_subscription_is_expired(self):
        client = APIClient()
        self.assertEqual(
            [p['title'] for p in client.get('/api/v1/education/programs/').data],
            ['Licence Informatique'],
        )
        self._expire_subscription()
        self.assertEqual(client.get('/api/v1/education/programs/').data, [])

    def test_program_facets_are_hidden_when_subscription_is_expired(self):
        client = APIClient()
        url = '/api/v1/education/programs/facets/'
        response = client.get(url)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['domains'], ['Informatique'])
        self.assertEqual(len(response.data['faculties']), 1)
        self._expire_subscription()
        response = client.get(url)
        self.assertEqual(response.data['domains'], [])
        self.assertEqual(response.data['faculties'], [])

    def test_profile_programs_action_is_hidden_when_subscription_is_expired(self):
        url = f'/api/v1/education/profiles/{self.published.id}/public_programs/'
        self.assertEqual(APIClient().get(url).status_code, 200)
        self._expire_subscription()
        self.assertEqual(APIClient().get(url).status_code, 404)

    def test_tenant_scope_still_exposes_nothing_from_another_tenant(self):
        """Un autre établissement Éducation reste inchangé : le filtre est ciblé."""
        other = Business.objects.create(
            owner=self.owner, primary_category=self.child, category=self.child,
            name='Université C', email='c@edu.test',
        )
        EducationProfile.objects.create(
            business=other, establishment_type='UNIVERSITY',
            publication_status=PublicationStatus.PUBLISHED,
        )
        EducationProgram.objects.create(
            business=other, title='Licence Civile', domain='Droit', is_public=True,
        )
        self._expire_subscription()
        titles = [p['title'] for p in APIClient().get('/api/v1/education/programs/').data]
        self.assertEqual(titles, ['Licence Civile'])

    def test_staff_backoffice_is_also_subscription_gated(self):
        """État actuel documenté, à trancher côté produit.

        `EducationProgramViewSet.get_queryset` renvoie le queryset public pour
        `list`, sans branche `mine=1` contrairement à `campaigns` et `fees`.
        Conséquence : un établissement résilié ne voit plus ses formations, et
        ne peut donc plus les éditer. Souhaité ou régression à corriger ?
        """
        self._expire_subscription()
        client = APIClient()
        client.force_authenticate(self.owner_b)
        self.assertEqual(client.get('/api/v1/education/programs/').data, [])


class ModerationNoteProtectionTests(EducationBaseTests):
    """`moderation_note` est écrit par la modération entreprises.

    Régression : le sérialiseur d'écriture l'acceptait, ce qui permettait à un
    établissement rejeté d'effacer ou de forger le motif.
    """

    def setUp(self):
        super().setUp()
        self.published.moderation_note = 'Documents illisibles.'
        self.published.save(update_fields=['moderation_note'])
        self.client = APIClient()
        self.client.force_authenticate(self.owner_b)
        self.url = f'/api/v1/education/profiles/{self.published.id}/'

    def test_owner_cannot_write_the_moderation_note(self):
        response = self.client.patch(
            self.url,
            {'moderation_note': 'Approuvé par l’administrateur.'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.published.refresh_from_db()
        self.assertEqual(self.published.moderation_note, 'Documents illisibles.')

    def test_owner_still_reads_the_moderation_note(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['moderation_note'], 'Documents illisibles.')

    def test_owner_still_writes_the_editorial_history(self):
        """`history` est éditorial (spec § Fiche établissement) : il reste libre."""
        response = self.client.patch(
            self.url, {'history': 'Fondée en 1972.'}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.published.refresh_from_db()
        self.assertEqual(self.published.history, 'Fondée en 1972.')


class ProfileCreatePermissionTests(EducationBaseTests):
    """`create` sur la fiche doit exiger `education.profile.update`.

    Régression : le viewset profil renvoyait `IsEducationTenant` pour toute
    écriture, dont `has_permission` se limitait à « l'utilisateur est membre ».
    Un employé sans droit d'écriture pouvait donc créer une fiche, alors que
    units et programs exigeaient bien leur code de permission.
    """

    def setUp(self):
        super().setUp()
        # `business` est unique sur EducationProfile : il faut une école qui
        # n'a pas encore de fiche pour tester `create`.
        self.school_c = Business.objects.create(
            owner=self.owner, primary_category=self.child, category=self.child,
            name='Université C', email='c-create@edu.test',
        )

    def _employee(self, permissions, business=None):
        business = business or self.school_c
        user = User.objects.create_user(
            email=f'agent-{business.id}-{len(permissions)}@edu.test',
            password='Pass123456!', role='EMPLOYEE',
        )
        role = BusinessRole.objects.create(business=business, name='Agent')
        role.permissions = list(permissions)
        role.save(update_fields=['permissions'])
        BusinessEmployee.objects.create(
            business=business, user=user, role=role, is_active=True,
        )
        return user

    def test_employee_without_permission_cannot_create_a_profile(self):
        user = self._employee([])
        client = APIClient()
        client.force_authenticate(user)
        response = client.post(
            '/api/v1/education/profiles/',
            {'establishment_type': 'UNIVERSITY', 'short_description': 'X'},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403), response.content)

    def test_employee_with_profile_update_can_create_a_profile(self):
        user = self._employee([PROFILE_UPDATE])
        client = APIClient()
        client.force_authenticate(user)
        response = client.post(
            '/api/v1/education/profiles/',
            {'establishment_type': 'UNIVERSITY', 'short_description': 'Nouvelle fiche'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(str(response.data['business']), str(self.school_c.id))
        self.assertEqual(response.data['publication_status'], PublicationStatus.DRAFT)

    def test_employee_with_profile_update_can_submit_for_review(self):
        user = self._employee([PROFILE_UPDATE])
        client = APIClient()
        client.force_authenticate(user)
        created = client.post(
            '/api/v1/education/profiles/',
            {'establishment_type': 'UNIVERSITY', 'short_description': 'Ecole'},
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        response = client.post('/api/v1/education/profiles/submit-for-review/')
        self.assertIn(response.status_code, (200, 201), response.content)

    def test_employee_without_permission_can_read_my_profile(self):
        """La lecture de SA fiche reste ouverte à tout membre de l'établissement."""
        user = self._employee([])
        client = APIClient()
        client.force_authenticate(user)
        response = client.get('/api/v1/education/profiles/my_profile/')
        self.assertEqual(response.status_code, 404, response.content)

    def test_other_tenant_still_cannot_create(self):
        client = APIClient()
        client.force_authenticate(self.shop_owner)
        response = client.post(
            '/api/v1/education/profiles/',
            {'establishment_type': 'UNIVERSITY'},
            format='json',
        )
        self.assertIn(response.status_code, (403, 404), response.content)


class FeeMerchantRoutingTests(EducationBaseTests):
    """Les frais d'une école doivent être encaissés sur le compte de l'école.

    Régression : `start_fee_payment` n'appelait pas `initiate_collection` avec
    `merchant=`, donc le débit tombait sur le compte de la plateforme Isoko Hub
    au lieu de l'établissement qui facture.
    """

    def setUp(self):
        super().setUp()
        self.fee = EducationFee.objects.create(
            business=self.school_b, program=self.program_public,
            academic_year='2026-2027', label='Inscription 2026',
            amount_bif=75000, is_public=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    def _pay(self):
        return self.client.post(
            f'/api/v1/education/fees/{self.fee.id}/pay/',
            {'payer_phone': '79551234'}, format='json',
        )

    def test_public_confirm_payment_does_not_require_login(self):
        anon = APIClient()
        response = anon.post(
            '/api/v1/education/applications/00000000-0000-0000-0000-000000000000/confirm-payment/',
            {'payment_token': 'x'},
            format='json',
        )
        self.assertEqual(response.status_code, 404, response.content)
        response = self._pay()
        self.assertEqual(response.status_code, 200, response.content)
        expected = f'EDU-{str(self.school_b.id).replace("-", "")[:10].upper()}'
        payment = EducationFeePayment.objects.get(fee=self.fee, applicant=self.student)
        self.assertEqual(payment.merchant_account, expected)
        self.assertEqual(response.data['payment']['merchant_account'], expected)

    def test_configured_merchant_account_wins(self):
        self.school_b.burundipay_merchant_account = 'EDU-BURUNDI-42'
        self.school_b.save(update_fields=['burundipay_merchant_account'])
        self.assertEqual(self._pay().status_code, 200)
        payment = EducationFeePayment.objects.get(fee=self.fee, applicant=self.student)
        self.assertEqual(payment.merchant_account, 'EDU-BURUNDI-42')

    def test_merchant_account_is_frozen_onto_the_payment(self):
        """Changer le compte après encaissement ne réécrit pas l'historique."""
        self._pay()
        payment = EducationFeePayment.objects.get(fee=self.fee, applicant=self.student)
        frozen = payment.merchant_account
        self.school_b.burundipay_merchant_account = 'EDU-BURUNDI-99'
        self.school_b.save(update_fields=['burundipay_merchant_account'])
        payment.refresh_from_db()
        self.assertEqual(payment.merchant_account, frozen)

    def test_stub_confirmation_is_refused_outside_simulation(self):
        self.assertEqual(self._pay().status_code, 200)
        with override_settings(BURUNDIPAY_STUB=False):
            response = self.client.post(
                f'/api/v1/education/fees/{self.fee.id}/confirm-payment/',
                {}, format='json',
            )
        self.assertEqual(response.status_code, 400, response.content)


class SchoolAccountantLedgerTests(EducationBaseTests):
    def test_accountant_lists_students_and_fees(self):
        from datetime import date

        from education.models import AdmissionCampaign, EnrollmentApplication
        from education.permission_catalog import FEES_MANAGE

        school_category = BusinessCategory.objects.create(
            name='École', slug='ecole-acc', parent=self.parent, module=ModuleKey.EDUCATION,
        )
        business = Business.objects.create(
            owner=self.owner_b, primary_category=school_category, category=school_category,
            name='Kazoza compta', email='compta-ecole@edu.test',
        )
        campaign = AdmissionCampaign.objects.create(
            business=business, academic_year='2026-2027',
            opens_on=date(2026, 9, 1), closes_on=date(2026, 11, 1),
        )
        fee = EducationFee.objects.create(
            business=business, academic_year='2026-2027', label='Frais d’inscription', amount_bif=50000,
        )
        application = EnrollmentApplication.objects.create(
            business=business, campaign=campaign, student_name='Nitanga Didace',
            student_email='didace-compta@edu.test', status='ACCEPTEE', track='ECOFO', ecofo_year='7',
        )
        EducationFeePayment.objects.create(fee=fee, application=application, status='PAID')
        accountant = User.objects.create_user(
            email='comptable@edu.test', password='Pass123456!', role='PROFESSIONAL',
        )
        role = BusinessRole.objects.create(
            business=business, name='Comptable', system_access_level='CASHIER_ACCESS',
            permissions=[FEES_MANAGE],
        )
        BusinessEmployee.objects.create(user=accountant, business=business, role=role, position='Comptable')

        client = APIClient()
        client.force_authenticate(accountant)
        response = client.get('/api/v1/education/accounting/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['students'][0]['student_name'], 'Nitanga Didace')
        self.assertEqual(response.data['students'][0]['payment_status'], 'PAID')
        self.assertEqual(response.data['students'][0]['fee_mode'], 'PAYANT')
        self.assertEqual(response.data['totals']['collected_bif'], 50000)

        stranger = APIClient()
        stranger.force_authenticate(self.student)
        self.assertEqual(stranger.get('/api/v1/education/accounting/').status_code, 403)


class ProductionGuardTests(EducationBaseTests):
    def test_confirm_payment_twice_keeps_the_first_timestamp(self):
        from datetime import date

        from education.enrollment import confirm_fee_stub
        from education.models import AdmissionCampaign, EnrollmentApplication

        campaign = AdmissionCampaign.objects.create(
            business=self.school_a, academic_year='2026-2027',
            opens_on=date(2026, 9, 1), closes_on=date(2026, 11, 1),
        )
        fee = EducationFee.objects.create(
            business=self.school_a, academic_year='2026-2027', label='Frais', amount_bif=1000,
        )
        application = EnrollmentApplication.objects.create(
            business=self.school_a, campaign=campaign, student_name='Aline',
            student_email='aline-guard@edu.test', status='LISTE_ATTENTE',
        )
        payment = EducationFeePayment.objects.create(
            fee=fee, application=application, status='AWAITING_PIN',
        )
        first = confirm_fee_stub(payment)
        second = confirm_fee_stub(first)
        self.assertEqual(second.status, 'PAID')
        self.assertEqual(first.paid_at, second.paid_at)

    def test_json_copy_can_be_run_twice(self):
        from datetime import date

        from django.core.management import call_command

        from education.models import AdmissionCampaign, SchoolCriterion, SchoolPlanSeat

        AdmissionCampaign.objects.create(
            business=self.school_a, academic_year='2027-2028',
            opens_on=date(2027, 9, 1), closes_on=date(2027, 11, 1),
            enrollment_plan=[{'track': 'ECOFO', 'year': '1', 'section': '', 'seats': 40}],
            extra_criteria=[{'kind': 'TEST', 'label': 'Français', 'date': '', 'place': '', 'details': ''}],
        )
        call_command('migrate_school_json')
        call_command('migrate_school_json')
        self.assertEqual(SchoolPlanSeat.objects.count(), 1)
        self.assertEqual(SchoolPlanSeat.objects.get().seats, 40)
        self.assertEqual(SchoolCriterion.objects.count(), 1)

    def test_unhandled_error_does_not_leak(self):
        from config.exceptions import api_exception_handler

        response = api_exception_handler(RuntimeError('secret stack'), {})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data['detail'], 'Erreur interne.')
        self.assertNotIn('secret', str(response.data))


class UniversityInscriptionTests(EducationBaseTests):
    def test_candidate_follows_the_published_campaign(self):
        from datetime import date, timedelta
        from django.core.files.uploadedfile import SimpleUploadedFile

        from education.enrollment import university_study_years
        from education.models import AdmissionCampaign, EnrollmentApplication

        self.program_public.study_year_labels = ['Licence 1', 'Licence 2']
        self.program_public.save()
        self.assertEqual(university_study_years(self.program_public), ['Licence 1', 'Licence 2'])
        self.program_public.study_year_labels = []
        self.program_public.duration_years = 3
        self.program_public.level = 'LICENCE'
        self.program_public.options = ['Génie logiciel']
        self.program_public.save()
        today = date.today()
        campaign = AdmissionCampaign.objects.create(
            business=self.school_b,
            program=self.program_public,
            academic_year='2026-2027',
            opens_on=today - timedelta(days=1),
            closes_on=today + timedelta(days=20),
            required_documents=[{'label': 'Diplôme', 'description': 'PDF'}],
            is_public=True,
        )
        pdf = SimpleUploadedFile('diplome.pdf', b'%PDF-1.4', content_type='application/pdf')
        identity = SimpleUploadedFile('carte.pdf', b'%PDF-1.4', content_type='application/pdf')
        photo = SimpleUploadedFile('passeport.jpg', b'\xff\xd8\xff\xd8', content_type='image/jpeg')
        response = APIClient().post('/api/v1/education/applications/apply/', {
            'campaign': str(campaign.id),
            'first_name': 'Aline',
            'last_name': 'Ndayishimiye',
            'student_email': 'aline@example.com',
            'student_phone': '79000000',
            'birth_date': '2004-05-02',
            'gender': 'F',
            'nationality': 'Burundaise',
            'marital_status': 'Célibataire',
            'avenue': 'Av. du Cinquantenaire',
            'zone': 'Kigobe',
            'commune': 'Ntahangwa',
            'province': 'Bujumbura Mairie',
            'country': 'Burundi',
            'previous_school': 'Lycée du Lac',
            'last_percent': '70',
            'state_exam_percent': '65',
            'studies_declared': 'Non',
            'guardian_link': 'Père',
            'guardian_name': 'Jean Ndayishimiye',
            'guardian_email': 'jean@example.com',
            'guardian_phone': '79111111',
            'guardian_address': 'Kigobe',
            'study_year': 'BAC I',
            'program_option': 'Génie logiciel',
            'terms_ack': '1',
            'doc_label_0': 'Photo passeport',
            'doc_file_0': photo,
            'doc_label_1': 'Carte d’identité',
            'doc_file_1': identity,
            'doc_label_2': 'Diplôme',
            'doc_file_2': pdf,
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.content)
        application = EnrollmentApplication.objects.get(student_email='aline@example.com')
        self.assertEqual(application.student_name, 'Aline Ndayishimiye')
        self.assertEqual(application.profile_details['study_year'], 'BAC I')
        self.assertEqual(application.profile_details['program_option'], 'Génie logiciel')
        self.assertEqual(application.files.count(), 3)
        self.assertTrue(application.files.filter(label='Carte d’identité').exists())
        from unittest.mock import patch

        from education.enrollment import decide_application

        with patch('education.enrollment._mail_to') as mail:
            decide_application(application, self.owner_b, 'REFUSEE')
        application.refresh_from_db()
        self.assertEqual(application.status, 'REFUSEE')
        body = mail.call_args.args[2]
        self.assertIn('ne peut pas accepter', body)
        self.assertNotIn('Motif', body)

    def test_admin_opens_bachelor_and_master_then_client_applies(self):
        """Université : l’admin ouvre un baccalauréat et un master, le candidat envoie les deux dossiers."""
        from datetime import date, timedelta
        from django.core.files.uploadedfile import SimpleUploadedFile

        admin = APIClient()
        admin.force_authenticate(self.owner_b)
        faculty = admin.post('/api/v1/education/units/', {
            'name': 'Faculté des sciences', 'kind': 'FACULTY',
        }, format='json')
        self.assertEqual(faculty.status_code, 201, faculty.content)

        bachelor = admin.post('/api/v1/education/programs/', {
            'title': 'Informatique',
            'level': 'LICENCE',
            'duration_years': '3',
            'duration_label': '3 ans',
            'unit': faculty.data['id'],
            'options': ['Génie logiciel'],
            'is_public': True,
        }, format='json')
        self.assertEqual(bachelor.status_code, 201, bachelor.content)
        self.assertEqual(bachelor.data['level'], 'LICENCE')
        self.assertEqual(bachelor.data['options'], ['Génie logiciel'])

        master = admin.post('/api/v1/education/programs/', {
            'title': 'Droit',
            'domain': 'Sciences juridiques',
            'level': 'MASTER',
            'duration_years': '2',
            'duration_label': '2 ans',
            'unit': None,
            'options': [],
            'study_year_labels': [],
            'is_public': True,
        }, format='json')
        self.assertEqual(master.status_code, 201, master.content)
        self.assertEqual(master.data['level'], 'MASTER')
        self.assertEqual(master.data['domain'], 'Sciences juridiques')
        self.assertIsNone(master.data['unit'])
        self.assertEqual(master.data['options'], [])
        self.assertEqual(master.data['study_year_labels'], [])

        listed = admin.get('/api/v1/education/programs/?mine=1')
        by_level = {row['level'] for row in listed.data if row['title'] in ('Informatique', 'Droit')}
        self.assertEqual(by_level, {'LICENCE', 'MASTER'})

        today = date.today()
        documents = [{'label': 'Diplôme', 'description': 'PDF'}]

        def open_campaign(program_id):
            return admin.post('/api/v1/education/campaigns/', {
                'program': program_id,
                'academic_year': '2026-2027',
                'opens_on': (today - timedelta(days=1)).isoformat(),
                'closes_on': (today + timedelta(days=30)).isoformat(),
                'required_documents': documents,
                'fee_mode': 'GRATUIT',
                'is_public': True,
            }, format='json')

        bachelor_campaign = open_campaign(bachelor.data['id'])
        master_campaign = open_campaign(master.data['id'])
        self.assertEqual(bachelor_campaign.status_code, 201, bachelor_campaign.content)
        self.assertEqual(master_campaign.status_code, 201, master_campaign.content)
        self.assertEqual(bachelor_campaign.data['program_level'], 'LICENCE')
        self.assertEqual(master_campaign.data['program_level'], 'MASTER')
        self.assertEqual(bachelor_campaign.data['study_years'], ['BAC I', 'BAC II', 'BAC III'])
        self.assertEqual(bachelor_campaign.data['program_options'], ['Génie logiciel'])
        self.assertEqual(master_campaign.data['study_years'], ['Master I', 'Master II'])
        self.assertEqual(master_campaign.data['program_options'], [])
        self.assertTrue(bachelor_campaign.data['open_today'])
        self.assertTrue(master_campaign.data['open_today'])
        self.assertEqual(bachelor_campaign.data['enrollment_fee']['fee_mode'], 'GRATUIT')
        self.assertEqual(master_campaign.data['enrollment_fee']['fee_mode'], 'GRATUIT')

        visitor = APIClient()
        public = visitor.get(f'/api/v1/education/campaigns/?business={self.school_b.id}')
        public_ids = {row['id'] for row in public.data}
        self.assertIn(bachelor_campaign.data['id'], public_ids)
        self.assertIn(master_campaign.data['id'], public_ids)
        seen_master = visitor.get(f"/api/v1/education/campaigns/{master_campaign.data['id']}/")
        self.assertEqual(seen_master.status_code, 200)
        self.assertEqual(seen_master.data['program_title'], 'Droit')
        self.assertEqual(seen_master.data['program_options'], [])

        def apply(campaign_id, email, study_year, option=''):
            payload = {
                'campaign': campaign_id,
                'first_name': 'Aline',
                'last_name': 'Ndayishimiye',
                'student_email': email,
                'student_phone': '79000000',
                'birth_date': '2004-05-02',
                'gender': 'F',
                'nationality': 'Burundaise',
                'marital_status': 'Célibataire',
                'avenue': 'Av. du Cinquantenaire',
                'zone': 'Kigobe',
                'commune': 'Ntahangwa',
                'province': 'Bujumbura Mairie',
                'country': 'Burundi',
                'previous_school': 'Lycée du Lac',
                'last_percent': '70',
                'state_exam_percent': '65',
                'studies_declared': 'Non',
                'guardian_link': 'Père',
                'guardian_name': 'Jean Ndayishimiye',
                'guardian_email': 'jean@example.com',
                'guardian_phone': '79111111',
                'guardian_address': 'Kigobe',
                'study_year': study_year,
                'terms_ack': '1',
                'doc_label_0': 'Photo passeport',
                'doc_file_0': SimpleUploadedFile('passeport.jpg', b'\xff\xd8\xff\xd8', content_type='image/jpeg'),
                'doc_label_1': 'Carte d’identité',
                'doc_file_1': SimpleUploadedFile('carte.pdf', b'%PDF-1.4', content_type='application/pdf'),
                'doc_label_2': 'Diplôme',
                'doc_file_2': SimpleUploadedFile('diplome.pdf', b'%PDF-1.4', content_type='application/pdf'),
            }
            if option:
                payload['program_option'] = option
            return visitor.post('/api/v1/education/applications/apply/', payload, format='multipart')

        bachelor_apply = apply(bachelor_campaign.data['id'], 'aline.bac@example.com', 'BAC I', 'Génie logiciel')
        self.assertEqual(bachelor_apply.status_code, 201, bachelor_apply.content)
        master_apply = apply(master_campaign.data['id'], 'aline.master@example.com', 'Master I')
        self.assertEqual(master_apply.status_code, 201, master_apply.content)
        self.assertEqual(master_apply.data['application']['profile_details']['study_year'], 'Master I')
        self.assertEqual(master_apply.data['application']['profile_details']['program_option'], '')

        dossiers = admin.get('/api/v1/education/applications/')
        emails = {row['student_email'] for row in dossiers.data}
        self.assertIn('aline.bac@example.com', emails)
        self.assertIn('aline.master@example.com', emails)

    def test_same_program_can_be_paid_and_free(self):
        client = APIClient()
        client.force_authenticate(self.owner_b)
        paid = client.post('/api/v1/education/campaigns/', {
            'program': str(self.program_public.id),
            'academic_year': '2028-2029',
            'opens_on': '2028-06-01',
            'closes_on': '2028-08-31',
            'required_documents': [{'label': 'Diplôme', 'description': 'PDF'}],
            'fee_mode': 'PAYANT',
            'fee_label': 'Frais d’inscription',
            'fee_amount_bif': 50000,
        }, format='json')
        self.assertEqual(paid.status_code, 201, paid.content)
        self.assertEqual(paid.data['enrollment_fee']['fee_mode'], 'PAYANT')
        self.assertEqual(paid.data['enrollment_fee']['amount_bif'], 50000)
        free = client.post('/api/v1/education/campaigns/', {
            'program': str(self.program_public.id),
            'academic_year': '2028-2029',
            'opens_on': '2028-06-01',
            'closes_on': '2028-08-31',
            'required_documents': [{'label': 'Diplôme', 'description': 'PDF'}],
            'fee_mode': 'GRATUIT',
        }, format='json')
        self.assertEqual(free.status_code, 201, free.content)
        self.assertEqual(free.data['enrollment_fee']['amount_bif'], 0)
        self.assertNotEqual(free.data['id'], paid.data['id'])
        duplicate = client.post('/api/v1/education/campaigns/', {
            'program': str(self.program_public.id),
            'academic_year': '2028-2029',
            'opens_on': '2028-06-01',
            'closes_on': '2028-08-31',
            'fee_mode': 'PAYANT',
            'fee_amount_bif': 10000,
        }, format='json')
        self.assertEqual(duplicate.status_code, 400)

    def test_complement_and_faculty_scope(self):
        from datetime import date, timedelta
        from unittest.mock import patch

        from businesses.models import BusinessEmployee, BusinessRole
        from education.enrollment import decide_application
        from education.models import AdmissionCampaign, EnrollmentApplication
        from education.scope import restrict_programs

        today = date.today()
        campaign = AdmissionCampaign.objects.create(
            business=self.school_b,
            program=self.program_public,
            academic_year='2029-2030',
            opens_on=today - timedelta(days=1),
            closes_on=today + timedelta(days=10),
            fee_mode='GRATUIT',
        )
        application = EnrollmentApplication.objects.create(
            business=self.school_b,
            campaign=campaign,
            student_name='Aline',
            student_email='aline-scope@example.com',
            status='ENVOYEE',
        )
        with patch('education.enrollment._mail_to'):
            decide_application(application, self.owner_b, 'COMPLEMENT_DEMANDE', note='Relevé illisible')
        application.refresh_from_db()
        self.assertEqual(application.status, 'COMPLEMENT_DEMANDE')
        self.assertIn('Relevé', application.decision_note)

        faculty = EducationUnit.objects.create(business=self.school_b, name='Sciences appliquées', kind='FACULTY')
        other = EducationUnit.objects.create(business=self.school_b, name='Droit', kind='FACULTY')
        self.program_public.unit = faculty
        self.program_public.save(update_fields=['unit'])
        hidden = EducationProgram.objects.create(
            business=self.school_b, unit=other, title='Droit privé', level='LICENCE', is_public=True,
        )
        staff = User.objects.create_user(email='faculte@edu.test', password='Pass123456!', role='PROFESSIONAL')
        role = BusinessRole.objects.create(
            business=self.school_b, name='Responsable faculté',
            permissions=['education.admissions.manage', 'education.programs.manage'],
        )
        BusinessEmployee.objects.create(
            user=staff, business=self.school_b, role=role, position='Doyen',
            education_scope_unit=faculty.id,
        )
        visible = restrict_programs(
            EducationProgram.objects.filter(business=self.school_b), faculty.id,
        )
        self.assertEqual(list(visible.values_list('id', flat=True)), [self.program_public.id])
        self.assertFalse(visible.filter(pk=hidden.id).exists())
        client = APIClient()
        client.force_authenticate(staff)
        listed = client.get('/api/v1/education/programs/?mine=1')
        self.assertEqual(listed.status_code, 200, listed.content)
        self.assertEqual([row['id'] for row in listed.data], [str(self.program_public.id)])


class TenantProtectionTests(EducationBaseTests):
    def test_program_create_is_written_to_the_audit_log(self):
        from accounts.models import AuditLog

        self.client.force_authenticate(self.owner)
        response = self.client.post(
            '/api/v1/education/programs/', {'title': 'Licence auditée'}, format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(
            AuditLog.objects.filter(
                action='EDUCATION_PROGRAM_CREATE',
                details__business_id=str(self.school_a.id),
            ).exists()
        )

    def test_dossier_personal_fields_are_encrypted_per_school(self):
        from datetime import date

        from django.db import connection

        from education.models import AdmissionCampaign, EnrollmentApplication

        campaign = AdmissionCampaign.objects.create(
            business=self.school_b, academic_year='2026-2027',
            opens_on=date(2026, 1, 1), closes_on=date(2026, 12, 31),
        )
        application = EnrollmentApplication.objects.create(
            business=self.school_b, campaign=campaign, student_name='Aline',
            student_email='aline-secret@edu.test', student_phone='79000000',
            profile_details={'first_name': 'Aline'},
        )
        self.assertEqual(application.student_phone, '79000000')
        self.assertEqual(application.profile_details['first_name'], 'Aline')
        other = EnrollmentApplication.objects.create(
            business=self.school_a, campaign=AdmissionCampaign.objects.create(
                business=self.school_a, academic_year='2026-2027',
                opens_on=date(2026, 1, 1), closes_on=date(2026, 12, 31),
            ),
            student_name='Aline', student_email='aline-a@edu.test', student_phone='79000000',
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT student_phone FROM education_enrollmentapplication WHERE student_name = %s',
                ['Aline'],
            )
            stored = [row[0] for row in cursor.fetchall()]
        self.assertEqual(len(stored), 2)
        self.assertTrue(all(str(value).startswith('enc1:') for value in stored))
        self.assertNotEqual(stored[0], stored[1])
        application.refresh_from_db()
        self.assertEqual(application.student_phone, '79000000')
        self.assertEqual(application.profile_details['first_name'], 'Aline')

