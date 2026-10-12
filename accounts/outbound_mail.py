"""Courriers transactionnels : en-têtes sobres pour limiter le classement en spam."""
import re

from django.conf import settings
from django.core.mail import EmailMessage

_LOCAL = re.compile(r'https?://(?:localhost|127\.0\.0\.1)(?::\d+)?\S*', re.I)


def mailbox_address():
    raw = (getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'info.isokohub@gmail.com').strip()
    if '<' in raw and '>' in raw:
        return raw.split('<', 1)[1].split('>', 1)[0].strip()
    return raw


def from_address():
    raw = mailbox_address()
    if '<' in (getattr(settings, 'DEFAULT_FROM_EMAIL', '') or ''):
        configured = (getattr(settings, 'DEFAULT_FROM_EMAIL', '') or '').strip()
        if '<' in configured:
            return configured
    return f'Isoko Hub <{raw}>'


def prepare_body(message: str) -> str:
    """En production, un lien localhost est inutile et pousse Gmail vers le spam.
    En développement, le lien du dossier doit rester visible."""
    text = message or ''
    if not settings.DEBUG:
        text = _LOCAL.sub('(ouvrez Isoko Hub dans votre navigateur)', text)
    return text.strip() + '\n'


def send_isoko_mail(subject, message, recipients, *, reply_to=None, from_name=None):
    people = [r for r in recipients if r]
    if not people:
        return 0
    sender = from_address()
    if (from_name or '').strip():
        safe_name = ' '.join(from_name.replace('\n', ' ').replace('\r', ' ').split())
        sender = f'{safe_name} <{mailbox_address()}>'
    mail = EmailMessage(
        subject=(subject or 'Message Isoko Hub').strip(),
        body=prepare_body(message),
        from_email=sender,
        to=people,
        reply_to=[reply_to or sender],
    )
    return mail.send(fail_silently=False)
