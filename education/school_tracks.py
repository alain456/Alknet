"""Parcours scolaire saisi à l'inscription d'une école."""

from .models import EducationProfile
from .moderation import ensure_education_profile


def is_school_category(category):
    return bool(category and (getattr(category, 'slug', '') or '') == 'ecole')


def _tracks(data):
    extras = data.get('extra_attributes') or {}
    tracks = extras.get('school_tracks') or {}
    return tracks if isinstance(tracks, dict) else {}


def school_track_errors(category, data):
    """Une école doit annoncer ECOFO, le post-fondamental, ou les deux."""
    if not is_school_category(category):
        return []
    tracks = _tracks(data)
    offers_prescolaire = bool(tracks.get('offers_prescolaire'))
    offers_ecofo = bool(tracks.get('offers_ecofo'))
    offers_post = bool(tracks.get('offers_post_fondamental'))
    errors = []
    if not offers_prescolaire and not offers_ecofo and not offers_post:
        errors.append('École : précisez le préscolaire, l’ECOFO, le post-fondamental, ou une combinaison.')
    from .school_years import normalize_class_list

    cycles = tracks.get('ecofo_cycles') or []
    classes = normalize_class_list(tracks.get('ecofo_classes') or [])
    allowed_cycles = {code for code, _label in EducationProfile.ECOFO_CYCLE_CHOICES}
    if offers_ecofo and not classes and not [code for code in cycles if code in allowed_cycles]:
        errors.append('ECOFO : ajoutez au moins une classe.')
    sections = tracks.get('post_fondamental_sections') or []
    named = [
        section for section in sections
        if isinstance(section, dict) and (section.get('name') or '').strip()
    ]
    if offers_post and not named:
        errors.append('Post-fondamental : ajoutez au moins une section.')
    return errors


def remember_school_tracks(profile):
    """Garde le même choix sur l'entreprise, en plus de la fiche publique."""
    business = profile.business
    extras = dict(business.extra_attributes or {})
    extras['school_tracks'] = {
        'offers_prescolaire': bool(profile.offers_prescolaire),
        'offers_ecofo': bool(profile.offers_ecofo),
        'offers_post_fondamental': bool(profile.offers_post_fondamental),
        'ecofo_cycles': list(profile.ecofo_cycles or []),
        'ecofo_classes': list(profile.ecofo_classes or []),
        'post_fondamental_sections': list(profile.post_fondamental_sections or []),
    }
    business.extra_attributes = extras
    business.save(update_fields=['extra_attributes', 'updated_at'])


def apply_registration_tracks(business):
    """Recopie le choix d'inscription sur la fiche, sans écraser une fiche déjà complétée."""
    if not is_school_category(getattr(business, 'primary_category', None)):
        return None
    tracks = (business.extra_attributes or {}).get('school_tracks') or {}
    if not isinstance(tracks, dict) or not tracks:
        return None
    profile = ensure_education_profile(business)
    if profile.offers_prescolaire or profile.offers_ecofo or profile.offers_post_fondamental or profile.post_fondamental_sections:
        return profile
    from .school_years import normalize_class_list

    allowed_cycles = {code for code, _label in EducationProfile.ECOFO_CYCLE_CHOICES}
    allowed_orientations = {code for code, _label in EducationProfile.POST_ORIENTATION_CHOICES}
    cycles = [code for code in (tracks.get('ecofo_cycles') or []) if code in allowed_cycles]
    classes = normalize_class_list(tracks.get('ecofo_classes') or [])
    sections = []
    for section in tracks.get('post_fondamental_sections') or []:
        if not isinstance(section, dict):
            continue
        name = (section.get('name') or '').strip()
        orientation = section.get('orientation') or ''
        if name and orientation in allowed_orientations:
            raw_classes = section.get('classes') if section.get('classes') is not None else section.get('years')
            class_rows = normalize_class_list(raw_classes or [])
            sections.append({
                'orientation': orientation,
                'name': name,
                'classes': class_rows,
                'years': [row['value'] for row in class_rows],
            })
    profile.offers_prescolaire = bool(tracks.get('offers_prescolaire'))
    profile.offers_ecofo = bool(tracks.get('offers_ecofo'))
    profile.offers_post_fondamental = bool(tracks.get('offers_post_fondamental'))
    profile.ecofo_cycles = cycles
    profile.ecofo_classes = classes
    profile.post_fondamental_sections = sections
    profile.save(update_fields=[
        'offers_prescolaire', 'offers_ecofo', 'offers_post_fondamental', 'ecofo_cycles',
        'ecofo_classes', 'post_fondamental_sections', 'updated_at',
    ])
    return profile
