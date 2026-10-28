from django.core.management.base import BaseCommand
from django.utils.text import slugify
from business_categories.models import BusinessCategory, ModuleKey
from business_categories.hotel_sector import (
    KEEP_DESCRIPTION,
    KEEP_NAME,
    KEEP_SLUG,
    merge_hotel_tourism_root,
)
from business_categories.services_sector import SERVICES_ROOT_NAME, SERVICES_ROOT_SLUG

class Command(BaseCommand):
    help = "Seed complete hierarchical business categories tree"

    def handle(self, *args, **kwargs):
        tree_data = [
            {
                "name": "Commerce",
                "icon": "Store",
                "description": "Boutiques, supermarchés, mode et ventes au détail ou en gros.",
                "children": [
                    {"name": "Boutique", "icon": "Store", "description": "Magasins de vente au détail."},
                    {"name": "Supermarché", "icon": "ShoppingBag", "description": "Grande surface d'alimentation et produits divers."},
                    {"name": "Électronique", "icon": "Laptop", "description": "Vente d'appareils et équipements électroniques/informatiques."},
                    {"name": "Mode", "icon": "ShoppingBag", "description": "Vêtements, chaussures, maroquinerie et accessoires."},
                    {"name": "Quincaillerie", "icon": "HardHat", "description": "Outillage, quincaillerie et matériaux de bricolage."}
                ]
            },
            {
                "name": "Santé",
                "icon": "Stethoscope",
                "description": "Centres de santé, hôpitaux, pharmacies et cabinets médicaux.",
                "children": [
                    {"name": "Clinique", "icon": "Building2", "description": "Établissement de soins et hospitalisation."},
                    {"name": "Pharmacie de gros", "icon": "Pill", "description": "Distribution pharmaceutique en gros (B2B)."},
                    {"name": "Pharmacie de détail", "icon": "Pill", "description": "Officine de vente au détail / client B2B."},
                    {"name": "Pharmacie", "icon": "Pill", "description": "Vente de médicaments et fournitures médicales."},
                    {"name": "Laboratoire", "icon": "Stethoscope", "description": "Analyses médicales et biologiques."},
                    {"name": "Cabinet médical", "icon": "Stethoscope", "description": "Consultations spécialisées et soins de santé."},
                    {"name": "Centre de santé", "icon": "Building2", "description": "Dispensaires et centres de soins communautaires."}
                ]
            },
            {
                "name": KEEP_NAME,
                "slug": KEEP_SLUG,
                "icon": "Hotel",
                "description": KEEP_DESCRIPTION,
                "module": ModuleKey.HOTEL,
                "children": [
                    {"name": "Hôtel", "icon": "Hotel", "module": ModuleKey.HOTEL, "description": "Hébergement touristique et hôtelier."},
                    {"name": "Restaurant", "icon": "Store", "module": ModuleKey.RESTAURANT, "description": "Restauration sur place et à emporter."},
                    {"name": "Bar", "icon": "Store", "module": ModuleKey.RESTAURANT, "description": "Débit de boissons et animation."},
                    {"name": "Café", "icon": "Store", "module": ModuleKey.RESTAURANT, "description": "Salon de thé, café et rafraîchissements."},
                    {"name": "Traiteur", "icon": "ShoppingBag", "module": ModuleKey.RESTAURANT, "description": "Organisation de réceptions et repas d'événements."}
                ]
            },
            {
                "name": "Construction",
                "icon": "HardHat",
                "description": "Bâtiments, travaux publics, architecture et ingénierie.",
                "children": [
                    {"name": "Entreprise de construction", "icon": "HardHat", "description": "Réalisation de bâtiments et travaux BTP."},
                    {"name": "Cabinet d'architecture", "icon": "Building2", "description": "Conception et plans d'ouvrages."},
                    {"name": "Génie civil", "icon": "HardHat", "description": "Infrastructures et ouvrages d'art."},
                    {"name": "Bureau d'études", "icon": "Laptop", "description": "Expertise technique et études de faisabilité."}
                ]
            },
            {
                "name": "Agriculture",
                "icon": "Sprout",
                "description": "Production agricole, élevage, coopératives et agroalimentaire.",
                "children": [
                    {"name": "Coopérative agricole", "icon": "Sprout", "description": "Regroupement de producteurs et distribution."},
                    {"name": "Producteur", "icon": "Sprout", "description": "Culture végétale et vergers."},
                    {"name": "Élevage", "icon": "Sprout", "description": "Élevage de bétail, volaille et aquaculture."},
                    {"name": "Agroalimentaire", "icon": "Store", "description": "Transformation de produits agricoles."}
                ]
            },
            {
                "name": "Transport",
                "icon": "Car",
                "description": "Services de mobilité, logistique et location de véhicules.",
                "children": [
                    {"name": "Taxi", "icon": "Car", "description": "Transport urbain et interurbain de personnes."},
                    {"name": "Transport de marchandises", "icon": "Car", "description": "Fret, livraison et camionnage."},
                    {"name": "Location de véhicules", "icon": "Car", "description": "Location de voitures et engins."},
                    {"name": "Logistique", "icon": "Car", "description": "Entreposage, gestion de stock et expédition."}
                ]
            },
            {
                "name": "Technologie",
                "icon": "Laptop",
                "description": "Logiciels, agences digitales, réseaux et cybersécurité.",
                "children": [
                    {"name": "Développement logiciel", "icon": "Laptop", "description": "Création d'applications web et mobiles."},
                    {"name": "Agence digitale", "icon": "Laptop", "description": "Marketing digital et création de sites."},
                    {"name": "Cybersécurité", "icon": "Laptop", "description": "Sécurité des données et des systèmes."},
                    {"name": "Réseaux", "icon": "Laptop", "description": "Installation et maintenance des réseaux informatiques."}
                ]
            },
            {
                "name": "Éducation",
                "icon": "GraduationCap",
                "description": "Écoles, universités, instituts et formation professionnelle.",
                "children": [
                    {"name": "École", "icon": "GraduationCap", "description": "Enseignement primaire et secondaire."},
                    {"name": "Université", "icon": "GraduationCap", "description": "Enseignement supérieur et recherche."},
                    {"name": "Centre de formation", "icon": "GraduationCap", "description": "Formations professionnelles et certifiantes."},
                    {"name": "Cours particuliers", "icon": "GraduationCap", "description": "Soutien scolaire et tutorat."}
                ]
            },
            {
                "name": SERVICES_ROOT_NAME,
                "slug": SERVICES_ROOT_SLUG,
                "icon": "Briefcase",
                "description": (
                    "Prestataires de services. Isoko Hub prépare les catégories ; "
                    "à l’inscription le prestataire en choisit une, puis gère ses offres "
                    "dans l’espace prestataire."
                ),
                "module": ModuleKey.SERVICES,
                "children": [
                    {"name": "Avocat", "icon": "Briefcase", "description": "Conseil juridique et représentation en justice."},
                    {"name": "Comptable", "icon": "Briefcase", "description": "Gestion comptable, fiscale et audits."},
                    {"name": "Consultant", "icon": "Briefcase", "description": "Conseil en stratégie et management."},
                    {"name": "Architecte", "icon": "Building2", "description": "Maîtrise d'œuvre et aménagement d'espaces."},
                    {"name": "Agence", "icon": "Briefcase", "description": "Agences de services et courtage."},
                    {"name": "Garde d'enfants", "slug": "garde-denfants", "icon": "Heart", "description": "Garde, aide aux devoirs et activités d’éveil."},
                    {"name": "Aide à domicile", "slug": "aide-a-domicile", "icon": "Heart", "description": "Aide et accompagnement à domicile."},
                    {"name": "Accompagnement des personnes âgées", "slug": "accompagnement-personnes-agees", "icon": "Heart", "description": "Accompagnement des personnes âgées, malades ou en situation de handicap."},
                ],
            }
        ]

        merge_hotel_tourism_root()

        total_parents = 0
        total_children = 0

        for parent_data in tree_data:
            parent_slug = parent_data.get("slug") or slugify(parent_data["name"])
            parent_defaults = {
                "name": parent_data["name"],
                "description": parent_data["description"],
                "icon": parent_data["icon"],
                "parent": None,
            }
            if parent_data.get("module"):
                parent_defaults["module"] = parent_data["module"]
            parent_cat, _ = BusinessCategory.objects.get_or_create(
                slug=parent_slug,
                defaults=parent_defaults,
            )
            parent_cat.name = parent_data["name"]
            parent_cat.description = parent_data["description"]
            parent_cat.icon = parent_data["icon"]
            parent_cat.parent = None
            if parent_data.get("module"):
                parent_cat.module = parent_data["module"]
            parent_cat.save()
            total_parents += 1

            for child_data in parent_data.get("children", []):
                child_slug = child_data.get("slug") or slugify(child_data["name"])
                child_cat = (
                    BusinessCategory.objects.filter(slug=child_slug).first()
                    or BusinessCategory.objects.filter(name__iexact=child_data["name"]).first()
                )
                if child_cat is None:
                    child_cat = BusinessCategory(
                        name=child_data["name"],
                        slug=child_slug,
                        description=child_data["description"],
                        icon=child_data["icon"],
                        parent=parent_cat,
                    )
                child_cat.name = child_data["name"]
                child_cat.description = child_data["description"]
                child_cat.icon = child_data["icon"]
                child_cat.parent = parent_cat
                if child_data.get("module"):
                    child_cat.module = child_data["module"]
                elif parent_data.get("module"):
                    child_cat.module = parent_data["module"]
                child_cat.save()
                total_children += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeding hiérarchique terminé : {total_parents} Secteurs Principaux et {total_children} Sous-catégories créés !"
        ))
