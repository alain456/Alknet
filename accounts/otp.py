"""Code e-mail à 6 chiffres pour la seconde étape de connexion."""
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from accounts.outbound_mail import send_isoko_mail
from django.utils import timezone

from .models import LoginOtp


def start_email_otp(user):
    code = f'{secrets.randbelow(1000000):06d}'
    challenge = LoginOtp.objects.create(
        user=user,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    send_isoko_mail(
        'Votre code de connexion',
        f'Bonjour,\n\nVotre code Isoko Hub est {code}. Il expire dans 10 minutes.\n\n— Isoko Hub',
        [user.email],
    )
    return challenge


def verify_email_otp(challenge_id, code):
    challenge = LoginOtp.objects.filter(id=challenge_id, used=False).select_related('user').first()
    if not challenge or challenge.expires_at < timezone.now():
        return None
    if not check_password(str(code or '').strip(), challenge.code_hash):
        challenge.attempts = (challenge.attempts or 0) + 1
        if challenge.attempts >= 5:
            challenge.used = True
        challenge.save(update_fields=['attempts', 'used'])
        return None
    challenge.used = True
    challenge.save(update_fields=['used'])
    return challenge.user
