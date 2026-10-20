from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .enums import EducationEnumChoicesView
from .views import (
    EducationDistanceView,
    EducationProfileViewSet,
    EducationProgramViewSet,
    EducationUnitViewSet,
)
from .enrollment_views import (
    AdmissionCampaignViewSet, EducationFeeViewSet, EnrollmentApplicationViewSet,
    InscriptionBordereauView, SchoolFeeLedgerView,
    EnrollmentTrackConfirmPayView, EnrollmentTrackDocumentView, EnrollmentTrackPayView,
    EnrollmentTrackView,
)

router = DefaultRouter()
router.register(r'profiles', EducationProfileViewSet, basename='education-profile')
router.register(r'units', EducationUnitViewSet, basename='education-unit')
router.register(r'programs', EducationProgramViewSet, basename='education-program')
router.register(r'campaigns', AdmissionCampaignViewSet, basename='education-campaign')
router.register(r'applications', EnrollmentApplicationViewSet, basename='education-application')
router.register(r'fees', EducationFeeViewSet, basename='education-fee')

urlpatterns = [
    path('enum-choices/', EducationEnumChoicesView.as_view(), name='education-enum-choices'),
    path('distance/', EducationDistanceView.as_view(), name='education-distance'),
    path('accounting/', SchoolFeeLedgerView.as_view(), name='education-accounting'),
    path('accounting/<uuid:application_id>/bordereau/', InscriptionBordereauView.as_view(), name='education-bordereau'),
    path('applications/suivi/', EnrollmentTrackView.as_view(), name='education-application-track'),
    path('applications/suivi/document/', EnrollmentTrackDocumentView.as_view(), name='education-application-track-document'),
    path('applications/suivi/pay/', EnrollmentTrackPayView.as_view(), name='education-application-track-pay'),
    path('applications/suivi/confirm-payment/', EnrollmentTrackConfirmPayView.as_view(), name='education-application-track-confirm'),
    path('', include(router.urls)),
]
