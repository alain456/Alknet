"""Adresse publique d'un établissement : slug.isokohub.com."""

from django.utils.text import slugify

RESERVED_SLUGS = frozenset({
    'www', 'api', 'app', 'admin', 'static', 'media', 'mail', 'support', 'localhost',
})


def allocate_business_slug(name, exclude_pk=None):
    from .models import Business

    base = slugify(name or '')[:70] or 'etablissement'
    if base in RESERVED_SLUGS:
        base = f'{base}-hub'
    candidate = base
    taken = Business.objects.all()
    if exclude_pk:
        taken = taken.exclude(pk=exclude_pk)
    n = 2
    while taken.filter(slug=candidate).exists():
        candidate = f'{base}-{n}'[:80]
        n += 1
    return candidate


def public_path_for_business(business):
    """Page publique du module, à partir de la catégorie."""
    category = getattr(business, 'primary_category', None)
    module = ''
    if category is not None:
        module = getattr(category, 'module', '') or ''
        parent = getattr(category, 'parent', None)
        if not module and parent is not None:
            module = getattr(parent, 'module', '') or ''
    business_id = business.id
    if module == 'education':
        return f'/education/establishment/{business_id}'
    if module == 'hospital':
        return f'/hospitals/{business_id}'
    if module == 'hotel':
        return f'/hotels/{business_id}'
    if module == 'wholesale':
        return f'/businesses/{business_id}/catalog'
    if module == 'retail_pharmacy':
        return f'/businesses/{business_id}/pharmacy'
    if module == 'commerce':
        return f'/businesses/{business_id}/shop'
    return f'/businesses/{business_id}/shop'
