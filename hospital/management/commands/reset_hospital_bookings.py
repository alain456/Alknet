from django.core.management.base import BaseCommand
from hospital.models import Appointment, AppointmentSlot, Notification
from businesses.models import Business


class Command(BaseCommand):
    help = 'Supprime tous les rendez-vous et créneaux d\'un hôpital (repartir de zéro)'

    def add_arguments(self, parser):
        parser.add_argument('--hospital-id', type=str, help='UUID de l\'hôpital')
        parser.add_argument('--hospital-name', type=str, help='Nom partiel de l\'hôpital (ex: Baho)')
        parser.add_argument('--dry-run', action='store_true', help='Afficher sans supprimer')

    def handle(self, *args, **options):
        hospital = None
        if options['hospital_id']:
            hospital = Business.objects.filter(id=options['hospital_id']).first()
        elif options['hospital_name']:
            hospital = Business.objects.filter(name__icontains=options['hospital_name']).first()

        if not hospital:
            self.stderr.write('Hôpital introuvable.')
            return

        appt_count = Appointment.objects.filter(hospital=hospital).count()
        slot_count = AppointmentSlot.objects.filter(hospital=hospital).count()
        notif_count = Notification.objects.filter(appointment__hospital=hospital).count()

        self.stdout.write(
            f'Hôpital: {hospital.name}\n'
            f'  Rendez-vous: {appt_count}\n'
            f'  Créneaux: {slot_count}\n'
            f'  Notifications liées: {notif_count}'
        )

        if options['dry_run']:
            self.stdout.write('Mode dry-run — rien supprimé.')
            return

        Notification.objects.filter(appointment__hospital=hospital).delete()
        Appointment.objects.filter(hospital=hospital).delete()
        AppointmentSlot.objects.filter(hospital=hospital).delete()
        self.stdout.write(self.style.SUCCESS('Données de rendez-vous supprimées. Vous pouvez repartir de zéro.'))
