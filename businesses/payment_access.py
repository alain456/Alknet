"""Autorisation des opérations de paiement en parcours invité (BurundiPay).

Le checkout public (boutique, pharmacie de détail, grossiste) est accessible
sans compte : exiger IsAuthenticated casserait la vente. On applique donc une
autorisation à deux branches :

  1. propriétaire de la commande (client connecté) ou membre du tenant
     qui la porte ;
  2. sinon, présentation du jeton de possession ``payment_token`` secret
     remis à la création de la commande.
"""
from __future__ import annotations

import hmac
import secrets

from django.db.models import Q

TOKEN_HEADER = 'X-Payment-Token'
TOKEN_BODY_KEYS = ('payment_token', 'paymentToken')
TOKEN_BYTES = 32


def issue_payment_token() -> str:
    """Jeton opaque, 256 bits d'entropie, unique par commande."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def extract_payment_token(request) -> str:
    """Lit le jeton dans l'en-tête X-Payment-Token ou dans le corps JSON."""
    raw = (request.headers.get(TOKEN_HEADER) or '').strip()
    if raw:
        return raw
    data = getattr(request, 'data', None)
    if isinstance(data, dict):
        for key in TOKEN_BODY_KEYS:
            value = (data.get(key) or '').strip()
            if value:
                return value
    return ''


def token_matches(provided: str, expected: str) -> bool:
    provided = (provided or '').strip()
    expected = (expected or '').strip()
    if not provided or not expected or len(provided) != len(expected):
        return False
    return hmac.compare_digest(provided, expected)


def member_business_ids(user) -> list:
    if user is None or not getattr(user, 'is_authenticated', False):
        return []
    if getattr(user, 'role', '') == 'SUPER_ADMIN' or getattr(user, 'is_superuser', False):
        return []
    ids = set()
    owned = getattr(user, 'businesses', None)
    if owned is not None:
        ids.update(owned.values_list('id', flat=True))
    employments = getattr(user, 'employments', None)
    if employments is not None:
        ids.update(employments.filter(is_active=True).values_list('business_id', flat=True))
    return list(ids)


def can_pay_object(request, obj, *, owner_fields: tuple[str, ...] = (), business_attr: str = '') -> bool:
    """Titulaire, membre du tenant, ou jeton de possession. Jamais l'UUID seul."""
    if token_matches(extract_payment_token(request), getattr(obj, 'payment_token', '')):
        return True
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'role', '') == 'SUPER_ADMIN' or getattr(user, 'is_superuser', False):
        return False
    for field in owner_fields:
        owner_id = getattr(obj, f'{field}_id', None)
        if owner_id and owner_id == user.id:
            return True
    business = getattr(obj, business_attr, None) if business_attr else None
    business_id = getattr(business, 'id', None) or getattr(obj, f'{business_attr}_id', None)
    return bool(business_id and business_id in member_business_ids(user))


def token_clause(token: str) -> Q:
    """Clause d'accès par jeton de possession (vide si aucun jeton fourni)."""
    return Q(payment_token=token) if token else Q()


def owner_clause(user, *fields: str) -> Q:
    """Clause d'accès pour les dossiers dont l'utilisateur est le titulaire.

    ``fields`` : chemins de relation vers l'utilisateur, ex. ``'customer'``,
    ``'created_by'``, ``'patient'``. Le super admin est volontairement exclu :
    il passe par les endpoints d'administration, pas par le parcours de paiement.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return Q()
    if getattr(user, 'is_superuser', False):
        return Q()
    clause = Q()
    for field in fields:
        clause |= Q(**{field: user})
    return clause


def tenant_clause(user, business_ids, *fields: str) -> Q:
    """Clause d'accès pour les dossiers portés par un business dont l'utilisateur est membre."""
    ids = [b for b in (business_ids or ()) if b]
    if not ids or user is None or not getattr(user, 'is_authenticated', False):
        return Q()
    clause = Q()
    for field in fields:
        clause |= Q(**{f'{field}__in': ids})
    return clause


def filter_by_payment_access(queryset, *clauses):
    """Applique les clauses d'accès au paiement.

    ``Q()`` vide matche TOUT : sans clause exploitable on renvoie ``none()``
    plutôt que de laisser fuiter le queryset.
    """
    clause = Q()
    has_clause = False
    for candidate in clauses:
        if candidate is not None and candidate.children:
            clause |= candidate
            has_clause = True
    if not has_clause:
        return queryset.none()
    return queryset.filter(clause)
