"""Recopie le plan et les critères JSON vers des lignes typées. Relançable."""
from django.core.management.base import BaseCommand

from education.models import AdmissionCampaign, SchoolCriterion, SchoolPlanSeat


class Command(BaseCommand):
    help = 'Copie enrollment_plan et extra_criteria vers SchoolPlanSeat et SchoolCriterion.'

    def handle(self, *args, **options):
        campaigns = 0
        seats = 0
        criteria = 0
        for campaign in AdmissionCampaign.objects.filter(program__isnull=True).iterator():
            campaigns += 1
            kept_seats = []
            for row in campaign.enrollment_plan or []:
                if not isinstance(row, dict):
                    continue
                track = str(row.get('track') or '').strip()
                if not track:
                    continue
                seat, _created = SchoolPlanSeat.objects.update_or_create(
                    campaign=campaign,
                    track=track,
                    year=str(row.get('year') or '').strip(),
                    section=str(row.get('section') or '').strip(),
                    defaults={'seats': max(0, int(row.get('seats') or 0))},
                )
                kept_seats.append(seat.pk)
                seats += 1
            SchoolPlanSeat.objects.filter(campaign=campaign).exclude(pk__in=kept_seats).delete()

            kept_criteria = []
            for position, item in enumerate(campaign.extra_criteria or []):
                if not isinstance(item, dict):
                    continue
                row, _created = SchoolCriterion.objects.update_or_create(
                    campaign=campaign,
                    position=position,
                    defaults={
                        'kind': str(item.get('kind') or '').strip(),
                        'label': str(item.get('label') or '').strip(),
                        'date': str(item.get('date') or '').strip(),
                        'place': str(item.get('place') or '').strip(),
                        'details': str(item.get('details') or '').strip(),
                    },
                )
                kept_criteria.append(row.pk)
                criteria += 1
            SchoolCriterion.objects.filter(campaign=campaign).exclude(pk__in=kept_criteria).delete()

        self.stdout.write(
            f'{campaigns} année(s), {seats} place(s), {criteria} critère(s).',
        )
