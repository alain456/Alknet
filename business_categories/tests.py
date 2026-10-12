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
