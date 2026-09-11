"""Teste l'envoi email SMTP configuré dans .env"""
from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand

from hospital.appointment_workflow import smtp_error_message


class Command(BaseCommand):
    help = 'Teste la configuration email (Gmail SMTP). Ex: python manage.py test_email patient@gmail.com'

    def add_arguments(self, parser):
        parser.add_argument('recipient', nargs='?', default=None, help='Email destinataire de test')

    def handle(self, *args, **options):
        recipient = options['recipient'] or settings.EMAIL_HOST_USER
        if not recipient:
            self.stderr.write(self.style.ERROR('Aucun destinataire. Passez un email en argument.'))
            return

        self.stdout.write(f'BACKEND: {settings.EMAIL_BACKEND}')
        self.stdout.write(f'HOST: {settings.EMAIL_HOST}:{settings.EMAIL_PORT} TLS={settings.EMAIL_USE_TLS}')
        self.stdout.write(f'FROM: {settings.DEFAULT_FROM_EMAIL or "(vide)"}')
        self.stdout.write(f'USER: {settings.EMAIL_HOST_USER or "(vide)"}')
        self.stdout.write(f'PASSWORD: {"OK" if settings.EMAIL_HOST_PASSWORD else "MANQUANT"}')
        self.stdout.write(f'TO: {recipient}')
        self.stdout.write('---')

        if not settings.DEFAULT_FROM_EMAIL:
            self.stderr.write(self.style.ERROR('DEFAULT_FROM_EMAIL manquant dans .env (entre guillemets).'))
            return
        if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            self.stderr.write(self.style.ERROR('EMAIL_HOST_USER ou EMAIL_HOST_PASSWORD manquant dans .env'))
            return

        try:
            send_mail(
                subject='[Isoko Hub] Test email',
                message='Si vous recevez ce message, la configuration SMTP fonctionne.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )
            self.stdout.write(self.style.SUCCESS(f'Email envoyé avec succès à {recipient}'))
        except Exception as exc:
            self.stderr.write(self.style.ERROR(smtp_error_message(exc)))
