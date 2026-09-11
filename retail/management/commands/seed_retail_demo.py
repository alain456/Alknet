from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from business_categories.models import BusinessCategory
from businesses.models import Business

from retail.models import RetailPharmacyProfile, RetailProduct
from retail.order_workflow import ensure_retail_profile

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed demo pharmacie de détail + catalogue patient + admin.pdetail'

    def handle(self, *args, **options):
        cat_detail = BusinessCategory.objects.filter(name__iexact='Pharmacie de détail').first()
        if not cat_detail:
            self.stderr.write('Categorie "Pharmacie de détail" manquante. Lancez seed_categories.')
            return

        owner, created = User.objects.get_or_create(
            email='admin.pdetail@isoko.com',
            defaults={
                'first_name': 'Admin',
                'last_name': 'PharmaDetail',
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
            name='Isoko Pharmacie Detail',
            defaults={
                'owner': owner,
                'primary_category': cat_detail,
                'category': cat_detail,
                'description': 'Officine de detail — commandes patients',
                'phone': '+257 22 00 00 33',
                'email': 'contact@isokopharmadétail.bi',
                'commune': 'Mukaza',
                'province': 'Bujumbura Mairie',
                'address': 'Avenue du Commerce',
                'is_active': True,
                'is_verified': True,
                'verification_status': 'APPROVED',
            },
        )
        # Garantir le lien owner même si le nom existait déjà sous un autre propriétaire
        if business.owner_id != owner.id:
            business.owner = owner
            business.save(update_fields=['owner', 'updated_at'])
        business.categories.add(cat_detail)

        profile = ensure_retail_profile(business)
        profile.commercial_name = 'Isoko Pharmacie Detail'
        profile.status = 'ACTIVE'
        profile.save()

        today = timezone.now().date()
        demo_products = [
            ('Paracetamol 500 mg', 'Paracetamol', '500 mg', 'Comprime', 'Boite de 20', 'Boite', Decimal('1500'), 80, False),
            ('Amoxicilline 500 mg', 'Amoxicilline', '500 mg', 'Gelule', 'Boite de 16 gelules', 'Boite', Decimal('6500'), 40, True),
            ('Ibuprofene 400 mg', 'Ibuprofene', '400 mg', 'Comprime', 'Boite de 30', 'Boite', Decimal('2800'), 12, False),
            ('Vitamine C 500 mg', 'Acide ascorbique', '500 mg', 'Comprime', 'Boite de 20', 'Boite', Decimal('2200'), 60, False),
            ('Sirop antitussif', 'Dextromethorphane', '15 mg/5ml', 'Sirop', 'Flacon 100 ml', 'Flacon', Decimal('4500'), 5, True),
        ]
        for i, (name, dci, dosage, form, pack, unit, price, qty, rx) in enumerate(demo_products):
            RetailProduct.objects.update_or_create(
                retail_business=business,
                name=name,
                defaults={
                    'active_ingredient': dci,
                    'dosage': dosage,
                    'pharmaceutical_form': form,
                    'administration_route': 'Orale',
                    'manufacturer': 'Demo Pharma',
                    'packaging': pack,
                    'sales_unit': unit,
                    'retail_price': price,
                    'currency': 'BIF',
                    'prescription_required': rx,
                    'quantity_real': qty,
                    'quantity_reserved': 0,
                    'low_stock_threshold': 10,
                    'batch_number': f'RD-2026-{i + 1:03d}',
                    'expiration_date': today + timedelta(days=365),
                    'status': 'ACTIVE',
                    'therapeutic_class': 'Antidouleur' if i < 3 else 'Vitamines',
                    'description': f'{name} — vente au detail',
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Demo retail OK: {business.name} ({RetailProduct.objects.filter(retail_business=business).count()} produits).\n'
                f'Compte: admin.pdetail@isoko.com / Isoko123!'
            )
        )
