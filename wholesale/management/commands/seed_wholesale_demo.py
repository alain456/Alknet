from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from business_categories.models import BusinessCategory
from businesses.models import Business
from wholesale.models import WholesaleProduct, WholesalePharmacyProfile
from wholesale.order_workflow import ensure_wholesale_profile

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo pharmacie de gros + 2 pharmacies de detail + catalogue"

    def handle(self, *args, **options):
        cat_gros = BusinessCategory.objects.filter(name__iexact="Pharmacie de gros").first()
        cat_detail = BusinessCategory.objects.filter(name__iexact="Pharmacie de détail").first()
        if not cat_gros or not cat_detail:
            self.stderr.write("Categories manquantes. Lancez seed_categories.")
            return

        def ensure_owner(email, first, last):
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "role": "BUSINESS_OWNER",
                    "is_active": True,
                    "is_email_verified": True,
                },
            )
            if created:
                user.set_password("Isoko123!")
                user.save()
            return user

        owner_gros = ensure_owner("admin.pgros@isoko.com", "Admin", "PharmaGros")
        owner_d1 = ensure_owner("client.pharma1@isoko.com", "Client", "Officine1")
        owner_d2 = ensure_owner("client.pharma2@isoko.com", "Client", "Officine2")

        gros, _ = Business.objects.update_or_create(
            name="Isoko Pharma Gros",
            defaults={
                "owner": owner_gros,
                "primary_category": cat_gros,
                "category": cat_gros,
                "description": "Grossiste pharmaceutique Bujumbura",
                "phone": "+257 22 00 00 01",
                "email": "contact@isokopharmagros.bi",
                "commune": "Mukaza",
                "province": "Bujumbura Mairie",
                "address": "Avenue de l Independence",
                "is_active": True,
                "is_verified": True,
                "verification_status": "APPROVED",
            },
        )
        gros.categories.add(cat_gros)
        profile = ensure_wholesale_profile(gros)
        profile.commercial_name = "Isoko Pharma Gros"
        profile.status = "ACTIVE"
        profile.save()

        for name, owner, phone in [
            ("Pharmacie du Centre", owner_d1, "+257 22 00 00 11"),
            ("Pharmacie Soleil", owner_d2, "+257 22 00 00 22"),
        ]:
            b, _ = Business.objects.update_or_create(
                name=name,
                defaults={
                    "owner": owner,
                    "primary_category": cat_detail,
                    "category": cat_detail,
                    "description": "Officine de detail",
                    "phone": phone,
                    "email": owner.email,
                    "commune": "Ntahangwa",
                    "is_active": True,
                    "is_verified": True,
                    "verification_status": "APPROVED",
                },
            )
            b.categories.add(cat_detail)

        demo_products = [
            ("Paracetamol 500 mg", "Paracetamol", "500 mg", "Comprime", "Boite de 20 comprimes", "Boite", Decimal("2500"), 200, 30),
            ("Amoxicilline 500 mg", "Amoxicilline", "500 mg", "Gelule", "Boite de 16 gelules", "Boite", Decimal("4800"), 120, 20),
            ("Serum physiologique", "NaCl 0.9%", "500 ml", "Solution", "Carton de 20 flacons", "Carton", Decimal("35000"), 40, 10),
            ("Ibuprofene 400 mg", "Ibuprofene", "400 mg", "Comprime", "Boite de 30 comprimes", "Boite", Decimal("3200"), 8, 15),
            ("Sirop antalgique", "Paracetamol", "120 mg/5ml", "Sirop", "Carton de 24 flacons", "Carton", Decimal("42000"), 0, 5),
        ]
        today = timezone.now().date()
        for i, (name, dci, dosage, form, pack, unit, price, qty, thr) in enumerate(demo_products):
            WholesaleProduct.objects.update_or_create(
                wholesale_business=gros,
                name=name,
                defaults={
                    "active_ingredient": dci,
                    "dosage": dosage,
                    "pharmaceutical_form": form,
                    "administration_route": "Orale",
                    "manufacturer": "Demo Pharma",
                    "packaging": pack,
                    "wholesale_unit": unit,
                    "wholesale_price": price,
                    "currency": "BIF",
                    "quantity_real": qty,
                    "quantity_reserved": 0,
                    "low_stock_threshold": thr,
                    "batch_number": f"LOT-2026-{i+1:03d}",
                    "expiration_date": today + timedelta(days=30 if i == 3 else 400),
                    "status": "ACTIVE",
                    "description": f"{name} — conditionnement professionnel",
                    "min_order_quantity": 1,
                },
            )

        self.stdout.write(self.style.SUCCESS(
            "Demo OK: Isoko Pharma Gros + 2 officines + 5 produits.\n"
            "Comptes: admin.pgros@isoko.com / client.pharma1@isoko.com / client.pharma2@isoko.com — mot de passe Isoko123!"
        ))
