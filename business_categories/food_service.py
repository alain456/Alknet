"""Restauration (café, bar, traiteur, restaurant) — pas un hébergement."""

FOOD_NAME_TOKENS = ('restaurant', 'resto', 'traiteur', 'café', 'cafe')
FOOD_EXACT = frozenset({'bar', 'café', 'cafe'})


def _category_blob(category):
    if not category:
        return ''
    return f'{getattr(category, "name", "") or ""} {getattr(category, "slug", "") or ""}'.lower()


def is_food_service_category(category):
    """Restaurant, bar, café, traiteur — même sous « Hôtellerie et tourisme »."""
    if not category:
        return False
    blob = _category_blob(category)
    if any(token in blob for token in FOOD_NAME_TOKENS):
        return True
    slug = (getattr(category, 'slug', '') or '').lower()
    name = (getattr(category, 'name', '') or '').lower().strip()
    return slug in FOOD_EXACT or name in FOOD_EXACT


def is_restaurant_business(business):
    """Établissement de restauration (fiche /restaurants), pas un hôtel."""
    if not business:
        return False
    category = getattr(business, 'primary_category', None) or getattr(business, 'category', None)
    if is_food_service_category(category):
        return True
    return (getattr(category, 'module', '') or '') == 'restaurant'
