"""Envoie les rappels J-1 avant check-out (staff + clients).

Usage:
  python manage.py notify_hotel_departures
  python manage.py notify_hotel_departures --dry-run
  python manage.py notify_hotel_departures --date 2026-09-18
"""
from datetime import date

from django.core.management.base import BaseCommand

from hotel.departure_reminders import process_departure_reminders


class Command(BaseCommand):
    help = (
        'Alerte manager / agent réservations et clients '
        'quand le check-out est demain (J-1).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Liste les réservations concernées sans envoyer.',
        )
        parser.add_argument(
            '--date',
            type=str,
            default='',
            help='Date de référence YYYY-MM-DD (défaut : aujourd’hui).',
        )

    def handle(self, *args, **options):
        on_date = None
        if options.get('date'):
            on_date = date.fromisoformat(options['date'])
        result = process_departure_reminders(
            on_date=on_date,
            dry_run=bool(options.get('dry_run')),
        )
        if result.get('dry_run'):
            self.stdout.write(
                self.style.WARNING(
                    f"Dry-run : {result['count']} réservation(s) — "
                    f"{', '.join(result.get('references') or []) or 'aucune'}"
                )
            )
            return
        self.stdout.write(
            self.style.SUCCESS(
                f"Rappels départ : {result.get('sent', 0)}/{result.get('count', 0)} envoyés."
            )
        )
