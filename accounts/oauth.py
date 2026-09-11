"""OAuth social (Google, Facebook, GitHub) — autorisation code + profil."""
from __future__ import annotations

import json
import logging
import secrets
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SocialIdentity
from .serializers import UserSerializer
from .services import log_audit_event

logger = logging.getLogger(__name__)
User = get_user_model()

STATE_SALT = 'isoko-oauth-state'
STATE_MAX_AGE = 600  # 10 min

PROVIDERS = ('google', 'facebook', 'github')


@dataclass(frozen=True)
class ProviderConfig:
    key: str
    label: str
    authorize_url: str
    token_url: str
    client_id: str
    client_secret: str
    scope: str
    extra_auth_params: dict | None = None


def backend_public_url() -> str:
    return (getattr(settings, 'BACKEND_URL', None) or 'http://localhost:8000').rstrip('/')


def frontend_public_url() -> str:
    return (getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173').rstrip('/')


def callback_url(provider: str) -> str:
    return f'{backend_public_url()}/api/v1/accounts/oauth/{provider}/callback/'


def get_provider_config(provider: str) -> ProviderConfig | None:
    provider = (provider or '').lower().strip()
    if provider == 'google':
        cid = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '') or ''
        secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', '') or ''
        if not cid or not secret:
            return None
        return ProviderConfig(
            key='google',
            label='Google',
            authorize_url='https://accounts.google.com/o/oauth2/v2/auth',
            token_url='https://oauth2.googleapis.com/token',
            client_id=cid,
            client_secret=secret,
            scope='openid email profile',
            extra_auth_params={'access_type': 'online', 'prompt': 'select_account'},
        )
    if provider == 'facebook':
        cid = getattr(settings, 'FACEBOOK_OAUTH_CLIENT_ID', '') or ''
        secret = getattr(settings, 'FACEBOOK_OAUTH_CLIENT_SECRET', '') or ''
        if not cid or not secret:
            return None
        return ProviderConfig(
            key='facebook',
            label='Facebook',
            authorize_url='https://www.facebook.com/v19.0/dialog/oauth',
            token_url='https://graph.facebook.com/v19.0/oauth/access_token',
            client_id=cid,
            client_secret=secret,
            scope='email,public_profile',
        )
    if provider == 'github':
        cid = getattr(settings, 'GITHUB_OAUTH_CLIENT_ID', '') or ''
        secret = getattr(settings, 'GITHUB_OAUTH_CLIENT_SECRET', '') or ''
        if not cid or not secret:
            return None
        return ProviderConfig(
            key='github',
            label='GitHub',
            authorize_url='https://github.com/login/oauth/authorize',
            token_url='https://github.com/login/oauth/access_token',
            client_id=cid,
            client_secret=secret,
            scope='read:user user:email',
        )
    return None


def providers_status() -> dict:
    return {
        p: {
            'configured': get_provider_config(p) is not None,
            'label': p.capitalize(),
        }
        for p in PROVIDERS
    }


def encode_state(*, next_path: str = '/dashboard', nonce: str | None = None) -> str:
    payload = {
        'n': nonce or secrets.token_urlsafe(16),
        'next': _safe_next(next_path),
    }
    return signing.dumps(payload, salt=STATE_SALT)


def decode_state(state: str) -> dict:
    return signing.loads(state, salt=STATE_SALT, max_age=STATE_MAX_AGE)


def _safe_next(path: str) -> str:
    path = (path or '/dashboard').strip()
    if not path.startswith('/') or path.startswith('//'):
        return '/dashboard'
    return path


def build_authorize_url(provider: str, *, next_path: str = '/dashboard') -> str:
    cfg = get_provider_config(provider)
    if not cfg:
        raise ValueError(f'Fournisseur OAuth « {provider} » non configuré.')
    state = encode_state(next_path=next_path)
    params = {
        'client_id': cfg.client_id,
        'redirect_uri': callback_url(provider),
        'response_type': 'code',
        'scope': cfg.scope,
        'state': state,
    }
    if cfg.extra_auth_params:
        params.update(cfg.extra_auth_params)
    return f'{cfg.authorize_url}?{urllib.parse.urlencode(params)}'


def _http_json(method: str, url: str, *, data: dict | None = None, headers: dict | None = None) -> dict:
    body = None
    req_headers = {'Accept': 'application/json', 'User-Agent': 'IsokoHub/1.0'}
    if headers:
        req_headers.update(headers)
    if data is not None:
        body = urllib.parse.urlencode(data).encode('utf-8')
        req_headers.setdefault('Content-Type', 'application/x-www-form-urlencoded')
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode('utf-8')
            if not raw:
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='replace')[:500]
        logger.warning('OAuth HTTP %s %s → %s %s', method, url, exc.code, detail)
        raise ValueError(f'Erreur fournisseur OAuth ({exc.code}).') from exc
    except urllib.error.URLError as exc:
        raise ValueError(f'Reseau OAuth indisponible: {exc.reason}') from exc


def exchange_code(provider: str, code: str) -> str:
    cfg = get_provider_config(provider)
    if not cfg:
        raise ValueError('Fournisseur non configuré.')
    payload = {
        'client_id': cfg.client_id,
        'client_secret': cfg.client_secret,
        'code': code,
        'redirect_uri': callback_url(provider),
        'grant_type': 'authorization_code',
    }
    data = _http_json('POST', cfg.token_url, data=payload)
    token = data.get('access_token')
    if not token:
        raise ValueError('Impossible d\'obtenir le jeton d\'accès OAuth.')
    return token


def fetch_profile(provider: str, access_token: str) -> dict:
    """
    Retourne { provider_user_id, email, first_name, last_name, email_verified }.
    """
    if provider == 'google':
        data = _http_json(
            'GET',
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
        )
        email = (data.get('email') or '').strip().lower()
        if not email:
            raise ValueError('Google n\'a pas fourni d\'email. Autorisez l\'accès email.')
        return {
            'provider_user_id': str(data.get('sub') or ''),
            'email': email,
            'first_name': (data.get('given_name') or '').strip()[:50],
            'last_name': (data.get('family_name') or '').strip()[:50],
            'email_verified': bool(data.get('email_verified', True)),
        }

    if provider == 'facebook':
        qs = urllib.parse.urlencode({
            'fields': 'id,email,first_name,last_name,name',
            'access_token': access_token,
        })
        data = _http_json('GET', f'https://graph.facebook.com/v19.0/me?{qs}')
        email = (data.get('email') or '').strip().lower()
        if not email:
            raise ValueError(
                'Facebook n\'a pas fourni d\'email. Vérifiez les permissions de l\'app '
                'et utilisez un compte Facebook avec email confirmé.'
            )
        return {
            'provider_user_id': str(data.get('id') or ''),
            'email': email,
            'first_name': (data.get('first_name') or '').strip()[:50],
            'last_name': (data.get('last_name') or '').strip()[:50],
            'email_verified': True,
        }

    if provider == 'github':
        data = _http_json(
            'GET',
            'https://api.github.com/user',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github+json',
            },
        )
        email = (data.get('email') or '').strip().lower()
        if not email:
            emails = _http_json(
                'GET',
                'https://api.github.com/user/emails',
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Accept': 'application/vnd.github+json',
                },
            )
            if isinstance(emails, list):
                primary = next((e for e in emails if e.get('primary') and e.get('verified')), None)
                chosen = primary or next((e for e in emails if e.get('verified')), None) or (emails[0] if emails else None)
                if chosen:
                    email = (chosen.get('email') or '').strip().lower()
        if not email:
            raise ValueError('GitHub n\'a pas fourni d\'email public. Ajoutez un email vérifié sur GitHub.')
        name = (data.get('name') or '').strip()
        parts = name.split(None, 1) if name else []
        login = (data.get('login') or '').strip()
        return {
            'provider_user_id': str(data.get('id') or ''),
            'email': email,
            'first_name': (parts[0] if parts else login)[:50],
            'last_name': (parts[1] if len(parts) > 1 else '')[:50],
            'email_verified': True,
        }

    raise ValueError('Fournisseur inconnu.')


@transaction.atomic
def login_or_register_social(*, provider: str, profile: dict, request=None) -> dict:
    provider_user_id = (profile.get('provider_user_id') or '').strip()
    email = (profile.get('email') or '').strip().lower()
    if not provider_user_id or not email:
        raise ValueError('Profil OAuth incomplet.')

    identity = (
        SocialIdentity.objects.select_related('user')
        .filter(provider=provider, provider_user_id=provider_user_id)
        .first()
    )
    created = False
    if identity:
        user = identity.user
    else:
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.create_user(
                email=email,
                password=None,
                first_name=profile.get('first_name') or '',
                last_name=profile.get('last_name') or '',
                role='CUSTOMER',
                is_email_verified=bool(profile.get('email_verified')),
            )
            user.set_unusable_password()
            user.save(update_fields=['password'])
            created = True
        elif profile.get('email_verified') and not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified', 'updated_at'])

        SocialIdentity.objects.get_or_create(
            provider=provider,
            provider_user_id=provider_user_id,
            defaults={'user': user, 'email': email},
        )

    if not user.is_active:
        raise ValueError('Ce compte est désactivé.')

    refresh = RefreshToken.for_user(user)
    tokens = {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': UserSerializer(user).data,
        'created': created,
    }
    log_audit_event(
        user=user,
        action='OAUTH_LOGIN' if not created else 'OAUTH_REGISTER',
        resource=f'{provider}:{provider_user_id}',
        request=request,
        status='SUCCESS',
        details={'provider': provider, 'email': email, 'created': created},
    )
    return tokens


def frontend_oauth_redirect(*, access: str, refresh: str, next_path: str, error: str | None = None) -> str:
    base = f'{frontend_public_url()}/auth/oauth/callback'
    if error:
        qs = urllib.parse.urlencode({'error': error, 'next': _safe_next(next_path)})
        return f'{base}?{qs}'
    qs = urllib.parse.urlencode({
        'access': access,
        'refresh': refresh,
        'next': _safe_next(next_path),
    })
    return f'{base}?{qs}'
