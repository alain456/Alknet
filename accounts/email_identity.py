"""
Identité email de connexion — égalité STRICTE caractère par caractère
(après normalisation), jamais de préfixe / contains / fuzzy match.

Ex. m@gmail.com  ≠  ma@gmail.com
"""
from __future__ import annotations

from django.contrib.auth import get_user_model


def normalize_login_email(email: str | None) -> str:
    """Strip + minuscules sur TOUTE l'adresse (local + domaine)."""
    return (email or '').strip().lower()


def emails_strictly_equal(a: str | None, b: str | None) -> bool:
    return normalize_login_email(a) == normalize_login_email(b) and bool(normalize_login_email(a))


def get_user_by_login_email(email: str | None, *, queryset=None):
    """
    Retrouve un utilisateur UNIQUEMENT si l'email normalisé est identique.
    Ne matche jamais un préfixe (m@… ≠ ma@…).
    """
    User = get_user_model()
    normalized = normalize_login_email(email)
    if not normalized or '@' not in normalized:
        return None

    qs = queryset if queryset is not None else User.objects.all()
    # iexact = filtre case-insensitive ; on revalide ensuite l'égalité stricte
    # pour exclure tout comportement DB ambigu.
    candidates = list(qs.filter(email__iexact=normalized)[:5])
    for user in candidates:
        if emails_strictly_equal(user.email, normalized):
            return user
    return None
