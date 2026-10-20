"""Alerte les pharmacies dont un lot est périmé ou périme dans 30 jours.

Usage:
  python manage.py notify_expiring_lots
"""
from django.core.management.base import BaseCommand

from businesses.stock_alerts import scan_expiry_alerts


class Command(BaseCommand):
    help = 'Crée une alerte (une seule fois) pour les lots périmés ou proches de la péremption.'

    def handle(self, *args, **options):
        created = scan_expiry_alerts()
        self.stdout.write(self.style.SUCCESS(f'{created} alerte(s) de péremption créée(s).'))
