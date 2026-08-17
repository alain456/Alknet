from django.core.management.base import BaseCommand
from django.utils.text import slugify
from business_categories.models import BusinessCategory

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
                    {"name": "Pharmacie", "icon": "Pill", "description": "Vente de médicaments et fournitures médicales."},
                    {"name": "Laboratoire", "icon": "Stethoscope", "description": "Analyses médicales et biologiques."},
                    {"name": "Cabinet médical", "icon": "Stethoscope", "description": "Consultations spécialisées et soins de santé."},
                    {"name": "Centre de santé", "icon": "Building2", "description": "Dispensaires et centres de soins communautaires."}
                ]
            },
            {
                "name": "Hôtellerie & Restauration",
                "icon": "Hotel",
                "description": "Hôtels, restaurants, bars, cafés et services traiteurs.",
                "children": [
                    {"name": "Hôtel", "icon": "Hotel", "description": "Hébergement touristique et hôtelier."},
                    {"name": "Restaurant", "icon": "Store", "description": "Restauration sur place et à emporter."},
                    {"name": "Bar", "icon": "Store", "description": "Débit de boissons et animation."},
                    {"name": "Café", "icon": "Store", "description": "Salon de thé, café et rafraîchissements."},
                    {"name": "Traiteur", "icon": "ShoppingBag", "description": "Organisation de réceptions et repas d'événements."}
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
                "name": "Services professionnels",
                "icon": "Briefcase",
                "description": "Conseils, droit, comptabilité et agences spécialisées.",
                "children": [
                    {"name": "Avocat", "icon": "Briefcase", "description": "Conseil juridique et représentation en justice."},
                    {"name": "Comptable", "icon": "Briefcase", "description": "Gestion comptable, fiscale et audits."},
                    {"name": "Consultant", "icon": "Briefcase", "description": "Conseil en stratégie et management."},
                    {"name": "Architecte", "icon": "Building2", "description": "Maîtrise d'œuvre et aménagement d'espaces."},
                    {"name": "Agence", "icon": "Briefcase", "description": "Agences de services et courtage."}
                ]
            }
        ]

        total_parents = 0
        total_children = 0

        for parent_data in tree_data:
            parent_slug = slugify(parent_data["name"])
            parent_cat, _ = BusinessCategory.objects.get_or_create(
                slug=parent_slug,
                defaults={
                    "name": parent_data["name"],
                    "description": parent_data["description"],
                    "icon": parent_data["icon"],
                    "parent": None
                }
            )
            parent_cat.name = parent_data["name"]
            parent_cat.description = parent_data["description"]
            parent_cat.icon = parent_data["icon"]
            parent_cat.parent = None
            parent_cat.save()
            total_parents += 1

            for child_data in parent_data.get("children", []):
                child_slug = slugify(child_data["name"])
                child_cat, _ = BusinessCategory.objects.get_or_create(
                    slug=child_slug,
                    defaults={
                        "name": child_data["name"],
                        "description": child_data["description"],
                        "icon": child_data["icon"],
                        "parent": parent_cat
                    }
                )
                child_cat.name = child_data["name"]
                child_cat.description = child_data["description"]
                child_cat.icon = child_data["icon"]
                child_cat.parent = parent_cat
                child_cat.save()
                total_children += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeding hiérarchique terminé : {total_parents} Secteurs Principaux et {total_children} Sous-catégories créés !"
        ))
