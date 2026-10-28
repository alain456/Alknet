"""Une seule racine publique : Hôtellerie et tourisme (hôtels + restauration)."""

KEEP_SLUG = 'hotellerie-et-tourisme'
KEEP_NAME = 'Hôtellerie et tourisme'
KEEP_DESCRIPTION = (
    'Hôtels, lodges, guest houses, restaurants, bars, cafés et traiteurs.'
)
KEEP_ICON = 'Hotel'
DROP_SLUGS = ('hotellerie-restauration',)
DROP_NAMES = ('Hôtellerie & Restauration', 'Hotellerie & Restauration')
CHOOSE_ESTABLISHMENT_ERROR = (
    'Précisez le type d’établissement : Hôtel, restaurant, bar, café ou traiteur.'
)


def is_hotel_tourism_root(category):
    """Racine mixte : on ne s’inscrit pas dessus, il faut une sous-catégorie."""
    if not category or getattr(category, 'parent_id', None):
        return False
    slug = (getattr(category, 'slug', '') or '').lower()
    name = (getattr(category, 'name', '') or '').lower()
    if slug == KEEP_SLUG or name == KEEP_NAME.lower():
        return True
    blob = f'{name} {slug}'
    return 'tourisme' in blob and ('hôtellerie' in blob or 'hotellerie' in blob)


def _repoint_businesses(Business, old_ids, keep_id):
    Business.objects.filter(primary_category_id__in=old_ids).update(primary_category_id=keep_id)
    Business.objects.filter(category_id__in=old_ids).update(category_id=keep_id)
    through = Business.categories.through
    for link in through.objects.filter(businesscategory_id__in=old_ids):
        already = through.objects.filter(
            business_id=link.business_id, businesscategory_id=keep_id,
        ).exists()
        if already:
            link.delete()
        else:
            link.businesscategory_id = keep_id
            link.save(update_fields=['businesscategory_id'])


def merge_hotel_tourism_root(BusinessCategory=None, Business=None):
    """Fusionne « Hôtellerie & Restauration » dans « Hôtellerie et tourisme »."""
    if BusinessCategory is None:
        from business_categories.models import BusinessCategory
    if Business is None:
        from businesses.models import Business
    from business_categories.models import ModuleKey

    extras = list(BusinessCategory.objects.filter(parent__isnull=True, slug__in=DROP_SLUGS))
    extras += list(BusinessCategory.objects.filter(parent__isnull=True, name__in=DROP_NAMES))
    seen = set()
    old_rows = []
    for row in extras:
        if row.pk in seen or row.slug == KEEP_SLUG:
            continue
        seen.add(row.pk)
        old_rows.append(row)
    old_ids = [row.pk for row in old_rows]

    keep = (
        BusinessCategory.objects.filter(slug=KEEP_SLUG).first()
        or BusinessCategory.objects.filter(parent__isnull=True, name=KEEP_NAME).first()
    )
    if keep is None and not old_ids:
        return None
    if keep is None:
        keep = BusinessCategory.objects.create(
            slug=KEEP_SLUG,
            name=KEEP_NAME,
            icon=KEEP_ICON,
            description=KEEP_DESCRIPTION,
            module=ModuleKey.HOTEL,
            parent=None,
        )

    keep.name = KEEP_NAME
    keep.icon = KEEP_ICON
    keep.description = KEEP_DESCRIPTION
    keep.module = ModuleKey.HOTEL
    keep.parent = None
    keep.save()

    if old_ids:
        BusinessCategory.objects.filter(parent_id__in=old_ids).update(parent=keep)
        _repoint_businesses(Business, old_ids, keep.pk)
        BusinessCategory.objects.filter(pk__in=old_ids).delete()

    from .food_service import is_food_service_category
    for child in BusinessCategory.objects.filter(parent_id=keep.pk):
        wanted = ModuleKey.RESTAURANT if is_food_service_category(child) else ModuleKey.HOTEL
        if child.module != wanted:
            child.module = wanted
            child.save(update_fields=['module'])
    return keep
