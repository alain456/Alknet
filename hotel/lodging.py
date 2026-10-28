"""Hébergement public vs restauration sous la même racine « Hôtellerie »."""

from business_categories.food_service import (
    FOOD_EXACT,
    FOOD_NAME_TOKENS,
    is_food_service_category,
    is_restaurant_business,
)

LODGING_TOKENS = (
    'hôtel', 'hotel', 'lodge', 'guest house', 'guesthouse',
    'auberge', 'hostel', 'résidence', 'residence',
    'hébergement', 'hebergement',
)
LODGING_TYPES = frozenset({
    'HOTEL', 'GUEST_HOUSE', 'LODGE', 'RESIDENCE', 'HOSTEL', 'OTHER',
})


def _category_blob(category):
    if not category:
        return ''
    return f'{getattr(category, "name", "") or ""} {getattr(category, "slug", "") or ""}'.lower()


def is_lodging_category(category):
    """Catégorie elle-même (pas le parent) : Hôtel, lodge, auberge…"""
    if not category or is_food_service_category(category):
        return False
    if (getattr(category, 'module', '') or '') == 'restaurant':
        return False
    from business_categories.hotel_sector import is_hotel_tourism_root
    if is_hotel_tourism_root(category):
        return False
    blob = _category_blob(category)
    return any(token in blob for token in LODGING_TOKENS)


def is_lodging_business(business):
    """Établissement listable sur /hotels : un vrai hébergement, pas un resto."""
    if not business:
        return False
    if is_restaurant_business(business):
        return False
    category = getattr(business, 'primary_category', None) or getattr(business, 'category', None)
    if is_lodging_category(category):
        return True
    profile = getattr(business, 'hotel_profile', None)
    if profile is None:
        try:
            profile = business.hotel_profile
        except Exception:
            profile = None
    if profile and (getattr(profile, 'establishment_type', '') or 'HOTEL') in LODGING_TYPES:
        return True
    return False
