"""Secteur Services : Isoko Hub prépare les catégories, le prestataire en choisit une."""
from .models import BusinessCategory, ModuleKey

SERVICES_ROOT_SLUG = 'services'
SERVICES_ROOT_NAME = 'Services'
CHOOSE_CATEGORY_ERROR = (
    'Choisissez la catégorie de votre service parmi celles préparées par Isoko Hub.'
)
HIDDEN_CATEGORY_ERROR = (
    'Cette catégorie n’est pas encore ouverte aux inscriptions.'
)


def category_is_public(category):
    if not category or not getattr(category, 'is_visible', True):
        return False
    parent = getattr(category, 'parent', None)
    if parent is not None and not getattr(parent, 'is_visible', True):
        return False
    return True


def is_services_module(category):
    if not category:
        return False
    if getattr(category, 'module', '') == ModuleKey.SERVICES:
        return True
    parent = getattr(category, 'parent', None)
    return bool(parent and getattr(parent, 'module', '') == ModuleKey.SERVICES)


def is_services_root(category):
    if not category or getattr(category, 'parent_id', None):
        return False
    if getattr(category, 'module', '') == ModuleKey.SERVICES:
        return True
    return (getattr(category, 'slug', '') or '') == SERVICES_ROOT_SLUG


def get_services_root():
    root = BusinessCategory.objects.filter(
        slug=SERVICES_ROOT_SLUG, parent__isnull=True,
    ).first()
    if root:
        return root
    return BusinessCategory.objects.filter(
        module=ModuleKey.SERVICES, parent__isnull=True,
    ).order_by('name').first()


def resolve_registration_category(primary_cat):
    """Le secteur Services ne peut pas être choisi seul : il faut une catégorie préparée."""
    if not primary_cat:
        return None, None
    if not category_is_public(primary_cat):
        return None, HIDDEN_CATEGORY_ERROR
    if is_services_root(primary_cat):
        return None, CHOOSE_CATEGORY_ERROR
    from .hotel_sector import CHOOSE_ESTABLISHMENT_ERROR, is_hotel_tourism_root
    if is_hotel_tourism_root(primary_cat):
        return None, CHOOSE_ESTABLISHMENT_ERROR
    return primary_cat, None


def assign_prepared_service_category(category_id):
    category = BusinessCategory.objects.select_related('parent').filter(pk=category_id).first()
    if not category or not is_services_module(category) or is_services_root(category):
        return None, CHOOSE_CATEGORY_ERROR
    if not category_is_public(category):
        return None, HIDDEN_CATEGORY_ERROR
    return category, None
