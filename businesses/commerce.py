"""Helpers vertical Commerce — détection catégorie + profil + conformité."""
from __future__ import annotations

import hashlib
import re

COMMERCE_CHILD_KEYWORDS = (
    'boutique', 'mode', 'quincaillerie', 'supermarché', 'supermarche',
    'électronique', 'electronique', 'commerce',
)


def is_commerce_category(category) -> bool:
    if not category:
        return False
    name = (category.name or '').lower()
    slug = (category.slug or '').lower()
    parent = getattr(category, 'parent', None)
    parent_name = (getattr(parent, 'name', None) or '').lower() if parent else ''
    parent_slug = (getattr(parent, 'slug', None) or '').lower() if parent else ''
    if parent_slug == 'commerce' or parent_name == 'commerce':
        return True
    if slug == 'commerce' or name == 'commerce':
        return True
    return any(k in name or k in slug for k in COMMERCE_CHILD_KEYWORDS)


def is_commerce_business(business) -> bool:
    if not business:
        return False
    cat = getattr(business, 'primary_category', None) or getattr(business, 'category', None)
    return is_commerce_category(cat)


def ensure_commerce_profile(business):
    from .models import CommerceProfile
    profile, _ = CommerceProfile.objects.get_or_create(business=business)
    return profile


def next_order_reference(business) -> str:
    from django.utils import timezone
    from orders.models import Order

    profile = ensure_commerce_profile(business)
    prefix = (profile.order_reference_prefix or 'CMD').strip().upper()
    day = timezone.now().strftime('%y%m%d')
    count = Order.objects.filter(business=business, created_at__date=timezone.now().date()).count() + 1
    return f'{prefix}-{day}-{count:04d}'


def normalize_registry_number(value: str) -> str:
    """Normalise NIF / RCCM / patente pour comparaison (majuscules, sans espaces)."""
    raw = (value or '').strip().upper()
    return re.sub(r'[\s\-_.]+', '', raw)


def hash_document_payload(data_url: str) -> str:
    """SHA-256 du contenu (partie base64) pour détecter les doublons de fichiers."""
    payload = (data_url or '').strip()
    if not payload:
        return ''
    if ',' in payload and payload.startswith('data:'):
        payload = payload.split(',', 1)[1]
    digest = hashlib.sha256(payload.encode('utf-8', errors='ignore')).hexdigest()
    return digest


def validate_commerce_registration_documents(data: dict) -> list[str]:
    """
    Retourne une liste d'erreurs (vide = OK).
    Exige le NIF Burundi (numéro OBR + scan).
    """
    errors = []
    extras = data.get('extra_attributes') or {}
    if not isinstance(extras, dict):
        extras = {}

    nif = normalize_registry_number(
        data.get('nif_number') or extras.get('nif_number') or ''
    )
    nif_doc = (data.get('nif_document') or extras.get('nif_document') or '').strip()

    if not nif:
        errors.append('Le numéro NIF (OBR) est obligatoire pour le secteur Commerce.')
    if not nif_doc.startswith('data:'):
        errors.append('Le scan du NIF est obligatoire (PDF ou image).')

    return errors


def find_commerce_document_duplicates(*, nif: str, rccm: str = '', permit: str = '',
                                      nif_hash: str, rccm_hash: str = '', permit_hash: str = '',
                                      exclude_business_id=None) -> list[str]:
    """Détecte doublons de NIF (numéro ou fichier déjà utilisé)."""
    from .models import CommerceProfile

    qs = CommerceProfile.objects.all()
    if exclude_business_id:
        qs = qs.exclude(business_id=exclude_business_id)

    errors = []
    nif_n = normalize_registry_number(nif)

    if nif_n and qs.filter(nif_number=nif_n).exists():
        errors.append(f'Ce NIF ({nif}) est déjà enregistré pour une autre entreprise.')

    if nif_hash and qs.filter(nif_document_hash=nif_hash).exists():
        errors.append('Le fichier NIF fourni a déjà été utilisé (document en double).')

    return errors


def apply_commerce_compliance(business, data: dict):
    """Enregistre le NIF + scan sur CommerceProfile."""
    extras = data.get('extra_attributes') or {}
    if not isinstance(extras, dict):
        extras = {}

    nif = normalize_registry_number(data.get('nif_number') or extras.get('nif_number') or '')
    nif_doc = (data.get('nif_document') or extras.get('nif_document') or '').strip()
    nif_hash = hash_document_payload(nif_doc)

    profile = ensure_commerce_profile(business)
    profile.nif_number = nif
    profile.nif_document = nif_doc
    profile.nif_document_hash = nif_hash
    # Champs RCCM / patente laissés vides (non exigés)
    if not profile.commercial_name:
        profile.commercial_name = business.name
    profile.save()

    extras = dict(business.extra_attributes or {})
    extras.update({
        'nif_number': nif,
        'has_commerce_documents': True,
    })
    for key in ('nif_document', 'rccm_document', 'permit_document', 'rccm_number', 'permit_number'):
        extras.pop(key, None)
    business.extra_attributes = extras
    business.save(update_fields=['extra_attributes', 'updated_at'])
    return profile
