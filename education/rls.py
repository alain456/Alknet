"""Isolation PostgreSQL des tables éducation.

Le rôle `isoko_app` n'est pas superutilisateur : les policies s'appliquent.
Le `business_id` d'un formulaire n'est jamais repris. La session ne reçoit que
les établissements du compte, plus l'établissement d'une inscription publique
déjà résolue côté serveur.
"""
import logging

from django.db import connection

logger = logging.getLogger(__name__)
_ROLE_READY = False

_GUCS = (
    'isoko.business_ids',
    'isoko.user_id',
    'isoko.user_email',
    'isoko.dossier_token',
    'isoko.payment_token',
    'isoko.write_business',
)


def _postgres():
    return connection.vendor == 'postgresql'


def role_ready():
    global _ROLE_READY
    if _ROLE_READY or not _postgres():
        return _ROLE_READY
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = 'isoko_app'")
        _ROLE_READY = cursor.fetchone() is not None
    return _ROLE_READY


def _set(name, value):
    with connection.cursor() as cursor:
        cursor.execute('SELECT set_config(%s, %s, false)', [name, value or ''])


def allow_write(business_id):
    if not business_id or not role_ready():
        return
    _set('isoko.write_business', str(business_id))


def allow_dossier_token(token):
    token = (token or '').strip()
    if not token or not role_ready():
        return
    _set('isoko.dossier_token', token)


def allow_payment_token(token):
    token = (token or '').strip()
    if not token or not role_ready():
        return
    _set('isoko.payment_token', token)


def bind_request(request):
    if not role_ready():
        return False
    from accounts.authentication import user_from_request
    from .permissions import education_business_ids

    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        user = user_from_request(request)
    ids = []
    user_id = ''
    email = ''
    if user is not None and getattr(user, 'is_authenticated', False):
        ids = [str(item) for item in education_business_ids(user)]
        user_id = str(user.pk)
        email = (getattr(user, 'email', '') or '').strip().lower()
    token = (request.GET.get('token') or '').strip()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SET ROLE isoko_app')
        _set('isoko.business_ids', ','.join(ids))
        _set('isoko.user_id', user_id)
        _set('isoko.user_email', email)
        _set('isoko.dossier_token', token)
        _set('isoko.payment_token', '')
        _set('isoko.write_business', '')
    except Exception:
        logger.exception('Isolation PostgreSQL indisponible')
        release()
        return False
    return True


def release():
    if not _postgres():
        return
    try:
        with connection.cursor() as cursor:
            cursor.execute('RESET ROLE')
        for name in _GUCS:
            _set(name, '')
    except Exception:
        logger.exception('Réinitialisation du rôle PostgreSQL impossible')


class EducationRlsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        bound = bind_request(request)
        try:
            return self.get_response(request)
        finally:
            if bound:
                release()
