"""
Client Lumicash pour abonnements SaaS (Entreprise → marchand Isoko Hub).

Mode stub (défaut) : simule push PIN sans appeler le réseau réel.
Quand LUMICASH_STUB=0 + clés API : brancher l'API marchande réelle ici.
"""
from __future__ import annotations

import logging
import os
import uuid

from django.conf import settings

logger = logging.getLogger(__name__)


def is_stub_mode() -> bool:
    return bool(getattr(settings, 'LUMICASH_STUB', True))


def merchant_account() -> str:
    return getattr(settings, 'LUMICASH_MERCHANT_ACCOUNT', 'ISOKO_HUB_MERCHANT') or 'ISOKO_HUB_MERCHANT'


def normalize_phone(phone: str) -> str:
    raw = ''.join(ch for ch in (phone or '') if ch.isdigit() or ch == '+')
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if digits.startswith('257') and len(digits) >= 11:
        return digits
    if len(digits) == 8:
        return f'257{digits}'
    return digits or raw


def initiate_collection(
    *,
    amount_bif: int,
    payer_phone: str,
    external_id: str,
    description: str,
    merchant: str | None = None,
) -> dict:
    """
    Demande un débit Lumicash vers un compte marchand.
    merchant=None → compte plateforme Isoko Hub (abonnements SaaS).
    """
    phone = normalize_phone(payer_phone)
    target_merchant = (merchant or '').strip() or merchant_account()
    if len(''.join(c for c in phone if c.isdigit())) < 8:
        return {
            'ok': False,
            'provider_reference': '',
            'status': 'FAILED',
            'message': 'Numéro Lumicash invalide.',
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
        if not settings.DEBUG and os.environ.get('LUMICASH_ALLOW_STUB_IN_PROD', '0') not in (
            '1', 'true', 'True', 'yes',
        ):
            return {
                'ok': False,
                'provider_reference': '',
                'status': 'FAILED',
                'message': 'Paiement Lumicash indisponible (mode stub interdit en production).',
                'raw': {},
            }
        ref = f'STUB-LC-{uuid.uuid4().hex[:12].upper()}'
        logger.info(
            'Lumicash STUB collection: amount=%s phone=%s merchant=%s ref=%s ext=%s',
            amount_bif, phone, target_merchant, ref, external_id,
        )
        return {
            'ok': True,
            'provider_reference': ref,
            'status': 'AWAITING_PIN',
            'message': (
                'Mode simulation : validez le paiement avec « Confirmer le PIN (simulation) ». '
                'En production, le client validera sur son téléphone Lumicash.'
            ),
            'raw': {
                'mode': 'stub',
                'merchant': target_merchant,
                'amount_bif': amount_bif,
                'payer_phone': phone,
                'description': description,
                'external_id': external_id,
            },
        }

    # Branchement API réelle (à compléter avec la doc partenaire Lumicash)
    api_url = getattr(settings, 'LUMICASH_API_URL', '').rstrip('/')
    api_key = getattr(settings, 'LUMICASH_API_KEY', '')
    if not api_url or not api_key:
        return {
            'ok': False,
            'provider_reference': '',
            'status': 'FAILED',
            'message': 'Lumicash non configuré (LUMICASH_API_URL / LUMICASH_API_KEY).',
            'raw': {},
        }

    # Placeholder — remplacer par la requête HTTP réelle
    logger.warning('Lumicash live initiate non encore implémenté (url=%s)', api_url)
    return {
        'ok': False,
        'provider_reference': '',
        'status': 'FAILED',
        'message': 'Intégration Lumicash live en cours de configuration.',
        'raw': {'api_url': api_url, 'merchant': target_merchant},
    }
