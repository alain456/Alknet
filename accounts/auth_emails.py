"""Tokens et emails d'auth (vérification email + reset mot de passe)."""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

logger = logging.getLogger(__name__)


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        return f'{user.pk}{timestamp}{user.is_email_verified}{user.email}'


email_verify_token = EmailVerificationTokenGenerator()
password_reset_token = PasswordResetTokenGenerator()


def encode_uid(user) -> str:
    return urlsafe_base64_encode(force_bytes(user.pk))


def decode_uid(uidb64: str):
    try:
        return force_str(urlsafe_base64_decode(uidb64))
    except (TypeError, ValueError, OverflowError):
        return None


def frontend_url(path: str) -> str:
    base = (getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173').rstrip('/')
    return f'{base}{path if path.startswith("/") else "/" + path}'


def send_verification_email(user) -> dict:
    uid = encode_uid(user)
    token = email_verify_token.make_token(user)
    link = frontend_url(f'/verify-email?uid={uid}&token={token}')
    subject = 'Isoko Hub — Vérifiez votre adresse email'
    message = (
        f'Bonjour {user.get_full_name() or user.email},\n\n'
        f'Confirmez votre compte Isoko Hub en ouvrant ce lien :\n{link}\n\n'
        f'Si vous n\'êtes pas à l\'origine de cette inscription, ignorez ce message.\n\n'
        f'— L\'équipe Isoko Hub\n'
    )
    return _send(user.email, subject, message)


def send_password_reset_email(user) -> dict:
    uid = encode_uid(user)
    token = password_reset_token.make_token(user)
    link = frontend_url(f'/reset-password?uid={uid}&token={token}')
    subject = 'Isoko Hub — Réinitialisation du mot de passe'
    message = (
        f'Bonjour {user.get_full_name() or user.email},\n\n'
        f'Pour choisir un nouveau mot de passe, ouvrez ce lien :\n{link}\n\n'
        f'Ce lien expire après usage ou après un délai court. '
        f'Si vous n\'avez pas demandé de reset, ignorez ce message.\n\n'
        f'— L\'équipe Isoko Hub\n'
    )
    return _send(user.email, subject, message)


def _send(recipient: str, subject: str, message: str) -> dict:
    if not recipient:
        return {'status': 'FAILED', 'error': 'Aucun destinataire'}
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient],
            fail_silently=False,
        )
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        logger.exception('Échec envoi email auth à %s', recipient)
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}
