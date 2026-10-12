"""Listes de choix exposées au frontend.

Les listes d'options étaient dupliquées côté React et avaient divergé des
choix du modèle : le filtre « type d'établissement » renvoyait zéro résultat
parce que les valeurs envoyées n'existaient pas en base. La source de vérité
reste le modèle ; l'API la sert.
"""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    EducationProgram, EducationProfile, EducationUnit, EnrollmentApplication, PublicationStatus,
)
from .school_enrollment_docs import TRACK_CHOICES, catalog_preview
from .school_years import year_label


def _pairs(choices):
    return [{'value': value, 'label': label} for value, label in choices]


class EducationEnumChoicesView(APIView):
    """Lecture seule, publique : une seule ressource, aucun état."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'anon'

    def get(self, request):
        return Response({
            'establishment_types': _pairs(EducationProfile.ESTABLISHMENT_TYPE_CHOICES),
            'operational_statuses': _pairs(EducationProfile.OPERATIONAL_STATUS_CHOICES),
            'publication_statuses': _pairs(PublicationStatus.choices),
            'levels': _pairs(EducationProgram.LEVEL_CHOICES),
            'unit_kinds': _pairs(EducationUnit.UNIT_KIND_CHOICES),
            'particularities': _pairs(EducationProfile.PARTICULARITY_FIELDS),
            'application_statuses': _pairs(EnrollmentApplication.STATUS),
            'enrollment_tracks': _pairs(TRACK_CHOICES),
            'ecofo_years': [{'value': str(y), 'label': year_label(y)} for y in range(1, 10)],
            'enrollment_documents_by_track': catalog_preview(),
            'ecofo_cycles': _pairs(EducationProfile.ECOFO_CYCLE_CHOICES),
            'post_orientations': _pairs(EducationProfile.POST_ORIENTATION_CHOICES),
            'boarding_regimes': _pairs(EducationProfile.BOARDING_REGIME_CHOICES),
            'post_filieres': {
                'intro': 'Il se divise en plusieurs filières après le cycle fondamental.',
                'families': [
                    {
                        'key': 'humanites',
                        'title': 'Général et Pédagogique',
                        'description': 'Axé sur les humanités (lettres, sciences, sciences économiques).',
                        'filieres': [
                            {
                                'value': 'GENERAL',
                                'label': 'Général',
                                'sections': list(EducationProfile.POST_HUMANITIES),
                                'allow_custom': False,
                            },
                            {
                                'value': 'PEDAGOGIQUE',
                                'label': 'Pédagogique',
                                'sections': list(EducationProfile.POST_HUMANITIES),
                                'allow_custom': False,
                            },
                        ],
                    },
                    {
                        'key': 'technique',
                        'title': 'Technique',
                        'description': 'Offre de nombreuses options spécialisées (agriculture, élevage, électromécanique, informatique).',
                        'filieres': [
                            {
                                'value': 'TECHNIQUE',
                                'label': 'Technique',
                                'sections': list(EducationProfile.POST_TECHNIQUE_OPTIONS),
                                'allow_custom': True,
                            },
                        ],
                    },
                ],
            },
        })
