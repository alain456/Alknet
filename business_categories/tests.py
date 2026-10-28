"""Le routage de module est une donnée, pas une devinette de mots-clés.

Ces tests verrouillent trois choses :
  1. la logique gelée dans la migration 0003 produit bien la correspondance
     attendue pour chaque secteur réel (aucune entreprise n'est reroutée) ;
  2. le champ `module` est renseigné et valide pour toutes les catégories ;
  3. à la création, une sous-catégorie sans module hérite de son parent.
"""

import importlib

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from businesses.models import Business

from .models import BusinessCategory, ModuleKey
from .serializers import BusinessCategorySerializer

User = get_user_model()

# La logique est figée dans la migration : elle ne doit surtout pas être
# réécrite, sinon `migrate` ne rejouerait pas le même routage sur un autre
# environnement. `importlib` car le nom de fichier commence par un chiffre.
_migration = importlib.import_module(
    'business_categories.migrations.0003_businesscategory_module'
)
resolve_module = _migration._resolve_module


class FrozenRoutingTableTests(TestCase):
    """Correspondance figée : c'est la référence de non-régression."""

    CASES = {
        # santé
        'sante': 'hospital',
        'hopital': 'hospital',
        'clinique': 'hospital',
        'centre-de-sante': 'hospital',
        'cabinet-medical': 'hospital',
        'pharmacie': 'retail_pharmacy',
        'pharmacie-de-detail': 'retail_pharmacy',
        'pharmacie-de-gros': 'wholesale',
        # hôtellerie — « Restaurant » et « Traiteur » restent génériques
        'hotel': 'hotel',
        'hotellerie-restauration': 'hotel',
        'restaurant': 'business',
        'traiteur': 'business',
        # commerce
        'commerce': 'commerce',
        'supermarche': 'commerce',
        'quincaillerie': 'commerce',
        'electronique': 'commerce',
        'mode': 'commerce',
        # génériques
        'transport': 'business',
        'laboratoire': 'business',
        'ecole': 'business',
    }

    def test_frozen_resolver_matches_expected_table(self):
        for slug, expected in self.CASES.items():
            with self.subTest(slug=slug):
                self.assertEqual(resolve_module(slug.replace('-', ' '), slug), expected)

    def test_every_expected_value_is_a_valid_choice(self):
        for slug, expected in self.CASES.items():
            with self.subTest(slug=slug):
                self.assertIn(expected, ModuleKey.values)

    def test_ambiguous_names_follow_first_match_order(self):
        """« Santé » est testé avant « commerce » : l'ordre est significatif."""
        # 'sant' matche avant 'commerce'
        self.assertEqual(resolve_module('Commerce de santé', 'commerce-de-sante'), 'hospital')
        # le fallback générique reste le filet de sécurité
        self.assertEqual(resolve_module('Transport', 'transport'), 'business')


class ModuleFieldTests(TestCase):
    def setUp(self):
        self.parent_hotel = BusinessCategory.objects.create(
            name='Hôtellerie', slug='hotellerie', module=ModuleKey.HOTEL
        )
        self.parent_generic = BusinessCategory.objects.create(
            name='Transport', slug='transport', module=ModuleKey.BUSINESS
        )

    def test_child_inherits_module_from_parent_on_create(self):
        child = BusinessCategory.objects.create(
            name='Auberge', slug='auberge', parent=self.parent_hotel
        )
        self.assertEqual(child.module, ModuleKey.HOTEL)

    def test_food_child_under_hotel_parent_gets_restaurant_module(self):
        child = BusinessCategory.objects.create(
            name='Café', slug='cafe-from-hotel-parent', parent=self.parent_hotel,
        )
        self.assertEqual(child.module, ModuleKey.RESTAURANT)

    def test_child_of_generic_parent_stays_generic(self):
        child = BusinessCategory.objects.create(
            name='Taxi', slug='taxi', parent=self.parent_generic
        )
        self.assertEqual(child.module, '')

    def test_explicit_module_wins_over_inheritance(self):
        child = BusinessCategory.objects.create(
            name='Centre thermal', slug='centre-thermal',
            parent=self.parent_hotel, module=ModuleKey.BUSINESS,
        )
        self.assertEqual(child.module, ModuleKey.BUSINESS)

    def test_inheritance_does_not_rewrite_an_existing_category(self):
        child = BusinessCategory.objects.create(
            name='Bar', slug='bar', parent=self.parent_hotel, module=ModuleKey.BUSINESS
        )
        child.name = 'Bar du coin'
        child.save()
        child.refresh_from_db()
        self.assertEqual(child.module, ModuleKey.BUSINESS)

    def test_serializer_exposes_module_and_label(self):
        payload = BusinessCategorySerializer(self.parent_hotel).data
        self.assertEqual(payload['module'], ModuleKey.HOTEL)
        self.assertTrue(payload['module_label'])
        self.assertTrue(payload['is_visible'])


class CategoryVisibilityTests(TestCase):
    """Création admin masquée ; l’œil publie côté client."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='sa-cat@test.bi', password='Pass123456!', role='SUPER_ADMIN',
            is_superuser=True,
        )
        self.root = BusinessCategory.objects.create(
            name='Secteur public', slug='secteur-public-vis',
            module=ModuleKey.BUSINESS, is_visible=True,
        )
        self.hidden = BusinessCategory.objects.create(
            name='Secteur brouillon', slug='secteur-brouillon-vis',
            module=ModuleKey.BUSINESS, is_visible=False,
        )

    def test_public_list_hides_invisible_categories(self):
        response = self.client.get('/api/v1/business-categories/')
        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in response.json()]
        self.assertIn(self.root.name, names)
        self.assertNotIn(self.hidden.name, names)

    def test_api_create_starts_hidden_from_clients(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            '/api/v1/business-categories/create/',
            {
                'name': 'Immobilier test vis',
                'slug': 'immobilier-test-vis',
                'description': '',
                'icon': 'Building2',
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertFalse(created.data['is_visible'])

        self.client.force_authenticate(None)
        public = self.client.get('/api/v1/business-categories/')
        names = [row['name'] for row in public.json()]
        self.assertNotIn('Immobilier test vis', names)

        self.client.force_authenticate(self.admin)
        still_hidden = self.client.get('/api/v1/business-categories/')
        self.assertNotIn('Immobilier test vis', [row['name'] for row in still_hidden.json()])
        admin_list = self.client.get('/api/v1/business-categories/?include_hidden=1')
        admin_names = [row['name'] for row in admin_list.json()]
        self.assertIn('Immobilier test vis', admin_names)

        patch = self.client.patch(
            f'/api/v1/business-categories/{created.data["id"]}/',
            {'is_visible': True},
            format='json',
        )
        self.assertEqual(patch.status_code, 200, patch.content)
        self.assertTrue(patch.data['is_visible'])

        self.client.force_authenticate(None)
        published = self.client.get('/api/v1/business-categories/')
        self.assertIn('Immobilier test vis', [row['name'] for row in published.json()])

    def test_hidden_parent_hides_visible_child_from_clients(self):
        child = BusinessCategory.objects.create(
            name='Sous visible', slug='sous-visible-vis',
            parent=self.hidden, is_visible=True,
        )
        response = self.client.get('/api/v1/business-categories/')
        names = [row['name'] for row in response.json()]
        self.assertNotIn(child.name, names)
        self.assertNotIn(self.hidden.name, names)

    def test_logged_in_super_admin_still_hides_drafts_on_registration_list(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/v1/business-categories/')
        names = [row['name'] for row in response.json()]
        self.assertNotIn(self.hidden.name, names)

    def test_registration_rejects_hidden_category(self):
        from .services_sector import HIDDEN_CATEGORY_ERROR, resolve_registration_category
        category, error = resolve_registration_category(self.hidden)
        self.assertIsNone(category)
        self.assertEqual(error, HIDDEN_CATEGORY_ERROR)


class LandingDirectoryTests(TestCase):
    """« Explore Categories » : pas de doublon, et Éducation toujours visible."""

    def setUp(self):
        self.client = APIClient()

        self.hotel = BusinessCategory.objects.create(
            name='Hôtellerie et tourisme', slug='hotellerie-et-tourisme',
            module=ModuleKey.HOTEL,
        )
        BusinessCategory.objects.create(
            name='Hôtel', slug='hotel', parent=self.hotel, module=ModuleKey.HOTEL,
        )
        self.education = BusinessCategory.objects.create(
            name='Éducation', slug='education', module=ModuleKey.EDUCATION,
        )
        for name, slug in (
            ('Université', 'universite'),
            ('École', 'ecole'),
            ('Centre de formation', 'centre-de-formation'),
            ('Cours particuliers', 'cours-particuliers'),
        ):
            BusinessCategory.objects.create(
                name=name, slug=slug, parent=self.education, module=ModuleKey.EDUCATION,
            )
        # Racine sans module et sans entreprise : ne doit pas apparaître.
        BusinessCategory.objects.create(name='Inutilisée', slug='inutilisee', module=ModuleKey.BUSINESS)

        self.owner = User.objects.create_user(
            email='hotel@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        hotel_child = BusinessCategory.objects.get(slug='hotel')
        Business.objects.create(
            owner=self.owner, primary_category=hotel_child, category=hotel_child,
            name='Hôtel du lac', email='hotel@test.bi',
        )

    def test_no_duplicate_hotel_root(self):
        """Une seule racine hôtelière, et elle porte ses enfants."""
        self.assertFalse(
            BusinessCategory.objects.filter(
                parent__isnull=True, module=ModuleKey.HOTEL,
            ).exclude(pk=self.hotel.pk).exists()
        )

    def test_unused_root_is_hidden_without_modules_param(self):
        response = self.client.get('/api/v1/business-categories/?used=1&parents_only=1')
        names = [row['name'] for row in response.json()]
        self.assertIn('Hôtellerie et tourisme', names)
        self.assertNotIn('Éducation', names)   # filtrée : aucun établissement
        self.assertNotIn('Inutilisée', names)

    def test_forced_hotel_root_appears_without_extra_business(self):
        response = self.client.get(
            '/api/v1/business-categories/?used=1&parents_only=1&modules=education,hotel'
        )
        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in response.json()]
        self.assertIn('Hôtellerie et tourisme', names)
        self.assertIn('Éducation', names)

    def test_forced_module_root_appears_with_its_children(self):
        response = self.client.get(
            '/api/v1/business-categories/?used=1&parents_only=1&modules=education'
        )
        self.assertEqual(response.status_code, 200)
        rows = response.json()
        names = [row['name'] for row in rows]
        self.assertIn('Éducation', names)

        education = next(r for r in rows if r['name'] == 'Éducation')
        children = {c['name'] for c in education['subcategories']}
        self.assertEqual(
            children, {'Université', 'École', 'Centre de formation', 'Cours particuliers'},
        )

    def test_forced_module_does_not_leak_other_empty_roots(self):
        response = self.client.get(
            '/api/v1/business-categories/?used=1&parents_only=1&modules=education'
        )
        names = [row['name'] for row in response.json()]
        self.assertNotIn('Inutilisée', names)
        # Et toujours une seule tuile hôtelière.
        self.assertEqual(
            len([n for n in names if 'Hôtellerie' in n]), 1,
        )


class ServicesSectorDeclarationTests(TestCase):
    """Isoko Hub prépare les catégories ; le prestataire en choisit une."""

    def setUp(self):
        self.root = BusinessCategory.objects.create(
            name='Services test root', slug='services-root-test', module=ModuleKey.SERVICES,
        )
        self.child = BusinessCategory.objects.create(
            name='Garde d’enfants test', slug='garde-denfants-decl-test',
            parent=self.root, module=ModuleKey.SERVICES,
        )

    def test_root_alone_is_rejected(self):
        from .services_sector import resolve_registration_category
        category, error = resolve_registration_category(self.root)
        self.assertIsNone(category)
        self.assertIn('Choisissez', error)

    def test_prepared_child_is_accepted(self):
        from .services_sector import resolve_registration_category
        category, error = resolve_registration_category(self.child)
        self.assertIsNone(error)
        self.assertEqual(category.id, self.child.id)

    def test_assign_prepared_category(self):
        from .services_sector import assign_prepared_service_category
        category, error = assign_prepared_service_category(self.child.id)
        self.assertIsNone(error)
        self.assertEqual(category.id, self.child.id)
        rejected, message = assign_prepared_service_category(self.root.id)
        self.assertIsNone(rejected)
        self.assertIn('Choisissez', message)

    def test_public_directory_lists_only_used_service_categories(self):
        unused = BusinessCategory.objects.create(
            name='Plomberie inutilisée', slug='plomberie-inutilisee-test',
            parent=self.root, module=ModuleKey.SERVICES,
        )
        owner = User.objects.create_user(
            email='used-cat@test.bi', password='Pass123456!', role='BUSINESS_OWNER',
        )
        Business.objects.create(
            owner=owner, primary_category=self.child, category=self.child,
            name='Prestataire utilisé', email='used-cat@test.bi',
            is_active=True, is_verified=True, verification_status='APPROVED',
        )
        response = self.client.get('/api/v1/business-categories/?used=1&modules=services')
        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in response.json()]
        self.assertIn(self.child.name, names)
        self.assertNotIn(unused.name, names)
        self.assertNotIn(self.root.name, names)


class HotelTourismRootTests(TestCase):
    def test_merge_keeps_one_root_and_moves_restaurants(self):
        from business_categories.hotel_sector import KEEP_NAME, KEEP_SLUG, merge_hotel_tourism_root

        keep, _ = BusinessCategory.objects.get_or_create(
            slug=KEEP_SLUG,
            defaults={'name': KEEP_NAME, 'module': ModuleKey.HOTEL},
        )
        drop = BusinessCategory.objects.create(
            name='Hôtellerie & Restauration',
            slug='hotellerie-restauration',
            module=ModuleKey.HOTEL,
        )
        resto = BusinessCategory.objects.create(
            name='Restaurant', slug='restaurant-merge', parent=drop, module=ModuleKey.HOTEL,
        )
        merge_hotel_tourism_root()
        self.assertFalse(BusinessCategory.objects.filter(slug='hotellerie-restauration').exists())
        resto.refresh_from_db()
        self.assertEqual(resto.parent_id, keep.id)
        self.assertEqual(resto.module, ModuleKey.RESTAURANT)
        roots = BusinessCategory.objects.filter(parent__isnull=True, module=ModuleKey.HOTEL)
        self.assertEqual(roots.count(), 1)
        self.assertEqual(roots.get().name, KEEP_NAME)

    def test_registration_rejects_tourism_root_without_child(self):
        from business_categories.services_sector import resolve_registration_category
        from business_categories.hotel_sector import KEEP_NAME, KEEP_SLUG, merge_hotel_tourism_root

        keep, _ = BusinessCategory.objects.get_or_create(
            slug=KEEP_SLUG,
            defaults={'name': KEEP_NAME, 'module': ModuleKey.HOTEL},
        )
        merge_hotel_tourism_root()
        keep.refresh_from_db()
        category, error = resolve_registration_category(keep)
        self.assertIsNone(category)
        self.assertIn('Hôtel', error)
        child = BusinessCategory.objects.create(
            name='Restaurant inscrit', slug='restaurant-inscrit-root',
            parent=keep, module=ModuleKey.RESTAURANT,
        )
        accepted, no_error = resolve_registration_category(child)
        self.assertIsNone(no_error)
        self.assertEqual(accepted.id, child.id)
