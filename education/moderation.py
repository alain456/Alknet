"""Passage d'un établissement en publication.

L'annuaire public Éducation est piloté par `EducationProfile`, pas par
`Business` : sans fiche, un établissement approuvé par la modération reste
invisible côté client. C'est le même câblage que pour le gros et le détail
(voir `AdminModerationApproveView`), qui créent et activent leur profil au
moment de l'approbation.
"""

from django.utils import timezone

from .models import EducationProfile, PublicationStatus
from .permissions import is_education_business


def ensure_education_profile(business):
    """Fiche d'un établissement Éducation, créée si absente."""
    profile, _created = EducationProfile.objects.get_or_create(business=business)
    return profile


def publish_education_profile(business):
    """Approuvé par la plateforme ⇒ visible dans l'annuaire public.

    L'approbation d'inscription *est* l'acte de modération : c'est le seul
    moment où la plateforme intervene. Publier ici, plutôt que d'exiger une
    seconde validation, évite un pipeline sans issue — `publication_status`
    n'est pas modifiable par l'API, donc sans ce point de branchement aucune
    fiche ne pourrait jamais devenir publique.
    """
    if not is_education_business(business):
        return None
    profile = ensure_education_profile(business)
    from .school_tracks import apply_registration_tracks
    apply_registration_tracks(business)
    profile.refresh_from_db()
    if profile.publication_status == PublicationStatus.PUBLISHED:
        return profile
    profile.publication_status = PublicationStatus.PUBLISHED
    profile.published_at = timezone.now()
    profile.save(update_fields=['publication_status', 'published_at', 'updated_at'])
    return profile
