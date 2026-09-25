"""
Client BurundiPay — paiements instantanés (banques + mobile money).

Mode stub (défaut) : simule push PIN / remboursement sans réseau réel.
Mode live (BURUNDIPAY_STUB=0) : HTTP JSON configurable vers l'API partenaire.

Endpoints (surchargeables) :
  POST {API_URL}{COLLECT_PATH}   → initiation débit
  GET  {API_URL}{STATUS_PATH}    → statut ( {id} = provider_reference )
  POST {API_URL}{REFUND_PATH}    → remboursement

Compat : variables LUMICASH_* lues en fallback.
"""
from __future__ import annotations

import json
import logging
import os
import ssl
import uuid
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

PAYMENT_METHOD = 'BURUNDIPAY'
LEGACY_PAYMENT_METHODS = frozenset({'LUMICASH', 'BURUNDIPAY'})

_SUCCESS_STATUSES = frozenset({
    'SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED', 'COMPLETE', 'OK',
})
_PENDING_STATUSES = frozenset({
    'PENDING', 'AWAITING_PIN', 'AWAITING', 'PROCESSING', 'INITIATED', 'QUEUED',
})
_FAILED_STATUSES = frozenset({
    'FAILED', 'FAILURE', 'CANCELLED', 'CANCELED', 'EXPIRED', 'REJECTED', 'ERROR',
})


def _env(*keys: str, default: str = '') -> str:
    for key in keys:
        val = os.environ.get(key)
        if val is not None and str(val).strip() != '':
            return str(val).strip()
    return default


def is_stub_mode() -> bool:
    return bool(getattr(settings, 'BURUNDIPAY_STUB', True))


def merchant_account() -> str:
    return (
        getattr(settings, 'BURUNDIPAY_MERCHANT_ACCOUNT', 'ISOKO_HUB_MERCHANT')
        or 'ISOKO_HUB_MERCHANT'
    )


def normalize_phone(phone: str) -> str:
    raw = ''.join(ch for ch in (phone or '') if ch.isdigit() or ch == '+')
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if digits.startswith('257') and len(digits) >= 11:
        return digits
    if len(digits) == 8:
        return f'257{digits}'
    return digits or raw


def is_burundipay_method(method: str | None) -> bool:
    return (method or '').strip().upper() in LEGACY_PAYMENT_METHODS


def _setting(name: str, default: str = '') -> str:
    return (getattr(settings, name, None) or default or '').strip()


def _api_base() -> str:
    return _setting('BURUNDIPAY_API_URL').rstrip('/')


def _api_key() -> str:
    return _setting('BURUNDIPAY_API_KEY')


def _collect_path() -> str:
    return _setting('BURUNDIPAY_COLLECT_PATH', '/v1/collections') or '/v1/collections'


def _status_path_template() -> str:
    return _setting('BURUNDIPAY_STATUS_PATH', '/v1/collections/{id}') or '/v1/collections/{id}'


def _refund_path() -> str:
    return _setting('BURUNDIPAY_REFUND_PATH', '/v1/refunds') or '/v1/refunds'


def _callback_url() -> str:
    return _setting('BURUNDIPAY_CALLBACK_URL')


def _timeout_sec() -> float:
    raw = _setting('BURUNDIPAY_HTTP_TIMEOUT', '30') or '30'
    try:
        return max(5.0, float(raw))
    except (TypeError, ValueError):
        return 30.0


def _normalize_status(raw: Any) -> str:
    if raw is None:
        return ''
    return str(raw).strip().upper()


def _map_provider_status(raw_status: Any) -> str:
    status = _normalize_status(raw_status)
    if status in _SUCCESS_STATUSES:
        return 'PAID'
    if status in _FAILED_STATUSES:
        return 'FAILED'
    if status in _PENDING_STATUSES or not status:
        return 'AWAITING_PIN'
    # Statuts inconnus : traiter comme en cours
    return 'AWAITING_PIN'


def _extract_reference(payload: dict, fallback: str = '') -> str:
    if not isinstance(payload, dict):
        return fallback
    for key in (
        'provider_reference', 'reference', 'transaction_id', 'transactionId',
        'id', 'collection_id', 'payment_id', 'txn_id',
    ):
        val = payload.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    data = payload.get('data')
    if isinstance(data, dict):
        return _extract_reference(data, fallback)
    return fallback


def _extract_status(payload: dict) -> str:
    if not isinstance(payload, dict):
        return ''
    for key in ('status', 'payment_status', 'state', 'result', 'code'):
        val = payload.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    data = payload.get('data')
    if isinstance(data, dict):
        return _extract_status(data)
    return ''


def _extract_message(payload: dict, default: str = '') -> str:
    if not isinstance(payload, dict):
        return default
    for key in ('message', 'detail', 'error', 'error_message', 'description'):
        val = payload.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()[:500]
    data = payload.get('data')
    if isinstance(data, dict):
        return _extract_message(data, default)
    return default


def _http_json(method: str, path: str, payload: dict | None = None) -> dict:
    """Appel HTTP JSON authentifié. Lève RuntimeError si transport/config KO."""
    base = _api_base()
    key = _api_key()
    if not base or not key:
        raise RuntimeError('BurundiPay non configuré (BURUNDIPAY_API_URL / BURUNDIPAY_API_KEY).')

    if not path.startswith('/'):
        path = f'/{path}'
    url = f'{base}{path}'
    body = None
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {key}',
        'X-API-Key': key,
        'User-Agent': 'IsokoHub-BurundiPay/1.0',
    }
    if payload is not None:
        body = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'

    req = Request(url, data=body, headers=headers, method=method.upper())
    ctx = ssl.create_default_context()
    try:
        with urlopen(req, timeout=_timeout_sec(), context=ctx) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            if not raw.strip():
                return {'http_status': getattr(resp, 'status', 200), 'ok': True}
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                return {'http_status': getattr(resp, 'status', 200), 'raw_text': raw[:1000]}
            if isinstance(data, dict):
                data = {**data, 'http_status': getattr(resp, 'status', 200)}
                return data
            return {'http_status': getattr(resp, 'status', 200), 'data': data}
    except HTTPError as exc:
        err_body = ''
        try:
            err_body = exc.read().decode('utf-8', errors='replace')
        except Exception:
            pass
        parsed: Any = {}
        if err_body:
            try:
                parsed = json.loads(err_body)
            except json.JSONDecodeError:
                parsed = {'raw_text': err_body[:1000]}
        message = _extract_message(parsed if isinstance(parsed, dict) else {}, f'HTTP {exc.code}')
        raise RuntimeError(message or f'BurundiPay HTTP {exc.code}') from exc
    except URLError as exc:
        raise RuntimeError(f'Reseau BurundiPay indisponible: {exc.reason}') from exc


def _live_ready_or_error() -> dict | None:
    if not _api_base() or not _api_key():
        return {
            'ok': False,
            'provider_reference': '',
            'status': 'FAILED',
            'message': 'BurundiPay non configuré (BURUNDIPAY_API_URL / BURUNDIPAY_API_KEY).',
            'raw': {},
        }
    return None


def initiate_collection(
    *,
    amount_bif: int,
    payer_phone: str,
    external_id: str,
    description: str,
    merchant: str | None = None,
) -> dict:
    """
    Demande un débit BurundiPay vers un compte marchand.
    merchant=None → compte plateforme Isoko Hub (abonnements SaaS).
    """
    phone = normalize_phone(payer_phone)
    target_merchant = (merchant or '').strip() or merchant_account()
    if len(''.join(c for c in phone if c.isdigit())) < 8:
        return {
            'ok': False,
            'provider_reference': '',
            'status': 'FAILED',
            'message': 'Numéro BurundiPay invalide.',
            'raw': {},
        }

    if amount_bif <= 0:
        return {
            'ok': False,
            'provider_reference': '',
            'status': 'FAILED',
            'message': 'Montant invalide.',
            'raw': {},
        }

    if is_stub_mode():
        if not settings.DEBUG and _env('BURUNDIPAY_ALLOW_STUB_IN_PROD', 'LUMICASH_ALLOW_STUB_IN_PROD', default='0') not in (
            '1', 'true', 'True', 'yes',
        ):
            return {
                'ok': False,
                'provider_reference': '',
                'status': 'FAILED',
                'message': 'Paiement BurundiPay indisponible (mode stub interdit en production).',
                'raw': {},
            }
        ref = f'STUB-BP-{uuid.uuid4().hex[:12].upper()}'
        logger.info(
            'BurundiPay STUB collection: amount=%s phone=%s merchant=%s ref=%s ext=%s',
            amount_bif, phone, target_merchant, ref, external_id,
        )
        return {
            'ok': True,
            'provider_reference': ref,
            'status': 'AWAITING_PIN',
            'message': (
                'Mode simulation : validez le paiement avec « Confirmer le PIN (simulation) ». '
                'En production, le client validera sur BurundiPay '
                '(banque ou mobile money).'
            ),
            'raw': {
                'mode': 'stub',
                'merchant': target_merchant,
                'amount_bif': amount_bif,
                'payer_phone': phone,
                'description': description,
                'external_id': external_id,
                'provider': PAYMENT_METHOD,
            },
            'stub_mode': True,
        }

    cfg_err = _live_ready_or_error()
    if cfg_err:
        return cfg_err

    body: dict[str, Any] = {
        'amount': int(amount_bif),
        'currency': 'BIF',
        'payer_msisdn': phone,
        'payer_phone': phone,
        'merchant_account': target_merchant,
        'external_id': str(external_id),
        'description': (description or '')[:255],
        'country': 'BI',
    }
    cb = _callback_url()
    if cb:
        body['callback_url'] = cb
        body['webhook_url'] = cb

    try:
        raw = _http_json('POST', _collect_path(), body)
    except RuntimeError as exc:
        logger.exception('BurundiPay live collect failed ext=%s', external_id)
        return {
            'ok': False,
            'provider_reference': '',
            'status': 'FAILED',
            'message': str(exc) or 'Échec initiation BurundiPay.',
            'raw': {'provider': PAYMENT_METHOD, 'external_id': external_id},
            'stub_mode': False,
        }

    ref = _extract_reference(raw, fallback='')
    mapped = _map_provider_status(_extract_status(raw))
    # Si l'API renvoie 2xx sans statut, considérer AWAITING_PIN
    if not _extract_status(raw) and raw.get('http_status', 200) < 400:
        mapped = 'AWAITING_PIN'
    ok = mapped != 'FAILED' and bool(ref or mapped == 'AWAITING_PIN')
    if mapped == 'FAILED':
        ok = False
    if not ref and ok:
        # Certaines APIs ne renvoient la ref qu'ensuite — on ancre sur external_id
        ref = f'BP-EXT-{str(external_id)[:20]}'

    message = _extract_message(
        raw,
        'Demande envoyée. Le client doit valider sur BurundiPay (PIN / banque / mobile money).'
        if ok else 'Échec initiation BurundiPay.',
    )
    logger.info(
        'BurundiPay LIVE collect: ok=%s status=%s ref=%s ext=%s',
        ok, mapped, ref, external_id,
    )
    return {
        'ok': ok,
        'provider_reference': ref,
        'status': mapped,
        'message': message,
        'raw': {**raw, 'mode': 'live', 'merchant': target_merchant, 'provider': PAYMENT_METHOD},
        'stub_mode': False,
    }


def check_collection_status(
    *,
    provider_reference: str = '',
    external_id: str = '',
) -> dict:
    """Interroge le statut d'une collecte (live) ou lit le stub."""
    ref = (provider_reference or '').strip()
    ext = (external_id or '').strip()

    if is_stub_mode():
        if ref.startswith('STUB-BP-') or ref.startswith('STUB-REF-'):
            return {
                'ok': True,
                'provider_reference': ref,
                'status': 'AWAITING_PIN',
                'message': 'Simulation : utilisez « Confirmer le PIN ».',
                'raw': {'mode': 'stub'},
                'stub_mode': True,
            }
        return {
            'ok': True,
            'provider_reference': ref,
            'status': 'AWAITING_PIN',
            'message': 'Mode simulation.',
            'raw': {'mode': 'stub'},
            'stub_mode': True,
        }

    cfg_err = _live_ready_or_error()
    if cfg_err:
        return cfg_err

    if not ref and not ext:
        return {
            'ok': False,
            'provider_reference': '',
            'status': 'FAILED',
            'message': 'Référence paiement manquante.',
            'raw': {},
            'stub_mode': False,
        }

    lookup = quote(ref or ext, safe='')
    path = _status_path_template().replace('{id}', lookup).replace('{reference}', lookup)
    # Query optionnelle pour APIs qui filtrent par external_id
    if ext and '{id}' not in _status_path_template():
        sep = '&' if '?' in path else '?'
        path = f'{path}{sep}external_id={quote(ext, safe="")}'

    try:
        raw = _http_json('GET', path, None)
    except RuntimeError as exc:
        logger.warning('BurundiPay status failed ref=%s: %s', ref, exc)
        return {
            'ok': False,
            'provider_reference': ref,
            'status': 'AWAITING_PIN',
            'message': str(exc),
            'raw': {},
            'stub_mode': False,
        }

    new_ref = _extract_reference(raw, fallback=ref)
    mapped = _map_provider_status(_extract_status(raw) or 'PENDING')
    return {
        'ok': mapped != 'FAILED',
        'provider_reference': new_ref,
        'status': mapped,
        'message': _extract_message(raw, f'Statut: {mapped}'),
        'raw': {**raw, 'mode': 'live'},
        'stub_mode': False,
    }


def refund_collection(
    *,
    amount_bif: int,
    payer_phone: str,
    provider_reference: str,
    external_id: str,
    description: str = '',
    merchant: str | None = None,
) -> dict:
    """
    Rembourse un paiement précédemment encaissé (vers le payeur d'origine).
    Stub : succès simulé. Live : POST refund API.
    """
    phone = normalize_phone(payer_phone)
    target_merchant = (merchant or '').strip() or merchant_account()
    ref = (provider_reference or '').strip()

    if amount_bif <= 0:
        return {
            'ok': True,
            'provider_reference': ref,
            'refund_reference': '',
            'status': 'REFUNDED',
            'message': 'Aucun montant à rembourser.',
            'raw': {},
            'stub_mode': is_stub_mode(),
        }

    if is_stub_mode():
        if not settings.DEBUG and _env('BURUNDIPAY_ALLOW_STUB_IN_PROD', 'LUMICASH_ALLOW_STUB_IN_PROD', default='0') not in (
            '1', 'true', 'True', 'yes',
        ):
            return {
                'ok': False,
                'provider_reference': ref,
                'refund_reference': '',
                'status': 'FAILED',
                'message': 'Remboursement BurundiPay indisponible (mode stub interdit en production).',
                'raw': {},
                'stub_mode': True,
            }
        refund_ref = f'STUB-REF-{uuid.uuid4().hex[:12].upper()}'
        logger.info(
            'BurundiPay STUB refund: amount=%s phone=%s orig=%s refund=%s ext=%s',
            amount_bif, phone, ref, refund_ref, external_id,
        )
        return {
            'ok': True,
            'provider_reference': ref,
            'refund_reference': refund_ref,
            'status': 'REFUNDED',
            'message': 'Remboursement simulé (stub BurundiPay).',
            'raw': {
                'mode': 'stub',
                'amount_bif': amount_bif,
                'payer_phone': phone,
                'original_reference': ref,
                'external_id': external_id,
                'merchant': target_merchant,
            },
            'stub_mode': True,
        }

    cfg_err = _live_ready_or_error()
    if cfg_err:
        return {
            **cfg_err,
            'refund_reference': '',
            'status': 'FAILED',
            'stub_mode': False,
        }

    if not ref:
        return {
            'ok': False,
            'provider_reference': '',
            'refund_reference': '',
            'status': 'FAILED',
            'message': (
                'Impossible de rembourser en live sans référence fournisseur. '
                'Relancez le paiement ou contactez le support BurundiPay.'
            ),
            'raw': {},
            'stub_mode': False,
        }

    body: dict[str, Any] = {
        'amount': int(amount_bif),
        'currency': 'BIF',
        'payer_msisdn': phone,
        'payer_phone': phone,
        'original_reference': ref,
        'provider_reference': ref,
        'transaction_id': ref,
        'external_id': f'refund-{external_id}' if external_id else f'refund-{uuid.uuid4().hex[:12]}',
        'merchant_account': target_merchant,
        'description': (description or f'Remboursement {ref}')[:255],
        'country': 'BI',
    }

    try:
        raw = _http_json('POST', _refund_path(), body)
    except RuntimeError as exc:
        logger.exception('BurundiPay live refund failed ref=%s', ref)
        return {
            'ok': False,
            'provider_reference': ref,
            'refund_reference': '',
            'status': 'FAILED',
            'message': str(exc) or 'Échec remboursement BurundiPay.',
            'raw': {'provider': PAYMENT_METHOD},
            'stub_mode': False,
        }

    refund_ref = _extract_reference(raw, fallback=f'REF-{ref[:16]}')
    mapped_raw = _normalize_status(_extract_status(raw))
    # Succès si statut success OU 2xx sans échec explicite
    failed = mapped_raw in _FAILED_STATUSES
    ok = not failed and raw.get('http_status', 200) < 400
    status_out = 'REFUNDED' if ok else 'FAILED'
    message = _extract_message(
        raw,
        'Remboursement BurundiPay effectué.' if ok else 'Échec remboursement BurundiPay.',
    )
    logger.info(
        'BurundiPay LIVE refund: ok=%s orig=%s refund=%s amount=%s',
        ok, ref, refund_ref, amount_bif,
    )
    return {
        'ok': ok,
        'provider_reference': ref,
        'refund_reference': refund_ref,
        'status': status_out,
        'message': message,
        'raw': {**raw, 'mode': 'live', 'merchant': target_merchant},
        'stub_mode': False,
    }
