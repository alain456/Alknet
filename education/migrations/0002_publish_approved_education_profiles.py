"""Rattrapage : publie les fiches Éducation des établissements déjà approuvés.

Avant le branchement de `AdminModerationApproveView` sur le module Éducation
(voir `education/moderation.py`), l'approbation d'une école n'aboutissait à
rien de visible : l'annuaire public est filtré sur `EducationProfile`, et
aucune fiche n'était créée. Les établissements approuvés avant ce correctif
sont donc invisibles côté client. Cette migration les publie.
"""

from django.db import migrations
from django.db.models import Q
from django.utils import timezone


def publish_missing_education_profiles(apps, schema_editor):
    Business = apps.get_model('businesses', 'Business')
    BusinessCategory = apps.get_model('business_categories', 'BusinessCategory')
    EducationProfile = apps.get_model('education', 'EducationProfile')

    education_ids = set(
        BusinessCategory.objects.filter(module='education').values_list('id', flat=True)
    )
    if not education_ids:
        return

    approved = Business.objects.filter(
        Q(primary_category_id__in=education_ids) | Q(category_id__in=education_ids),
        verification_status='APPROVED',
        is_active=True,
    )
    for business in approved.select_related('primary_category', 'primary_category__parent'):
        profile, created = EducationProfile.objects.get_or_create(business_id=business.id)
        if profile.publication_status == 'PUBLISHED':
            continue
        profile.publication_status = 'PUBLISHED'
        profile.published_at = profile.published_at or timezone.now()
        profile.save(update_fields=['publication_status', 'published_at', 'updated_at'])


def unpublish_education_profiles(apps, schema_editor):
    EducationProfile = apps.get_model('education', 'EducationProfile')
    EducationProfile.objects.update(publication_status='DRAFT', published_at=None)


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0001_initial'),
        ('business_categories', '0005_merge_hotel_roots'),
        ('education', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(publish_missing_education_profiles, unpublish_education_profiles),
    ]
