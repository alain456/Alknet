"""Cookies de session HttpOnly. Le JavaScript du navigateur ne lit pas les jetons."""
from django.conf import settings

ACCESS_COOKIE = 'isoko_access'
REFRESH_COOKIE = 'isoko_refresh'
# Indicateur de présence, volontairement lisible par le JS : les deux cookies de
# jetons sont httpOnly, donc le front ne peut pas savoir s'il doit tenter de
# restaurer la session. Sans cet indicateur, chaque visite d'un visiteur non
# connecté déclenchait /profile/ puis /refresh/ en 401 — bruit inutile, et
# deux requêtes sur le chemin critique du premier rendu.
SESSION_HINT_COOKIE = 'isoko_session'


def _secure() -> bool:
    if settings.DEBUG or getattr(settings, 'IS_TESTING', False):
        return False
    return True


def set_auth_cookies(response, access: str, refresh: str):
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=_secure(),
        samesite='Strict',
        path='/',
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=_secure(),
        samesite='Strict',
        path='/api/v1/accounts/',
    )
    # Ne contient aucun secret : seulement « une session existe ».
    response.set_cookie(
        SESSION_HINT_COOKIE,
        '1',
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=False,
        secure=_secure(),
        samesite='Strict',
        path='/',
    )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(ACCESS_COOKIE, path='/')
    response.delete_cookie(REFRESH_COOKIE, path='/api/v1/accounts/')
    response.delete_cookie(SESSION_HINT_COOKIE, path='/')
    return response
