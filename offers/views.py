from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from .models import Offer, Application
from .serializers import OfferSerializer, ApplicationSerializer

class CanManageOffers(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Rôles autorisés à créer des offres pour leur entreprise
        allowed = ['BUSINESS_OWNER']
        return request.user.role in allowed

class OfferListView(generics.ListAPIView):
    """
    Liste de toutes les offres actives (Public)
    """
    queryset = Offer.objects.filter(status='OPEN')
    serializer_class = OfferSerializer
    permission_classes = [permissions.AllowAny]

class MyBusinessOfferListView(generics.ListCreateAPIView):
    """
    Gérer les offres de son entreprise.
    """
    serializer_class = OfferSerializer
    permission_classes = [CanManageOffers]

    def get_queryset(self):
        return Offer.objects.filter(business__owner=self.request.user)

    def perform_create(self, serializer):
        business = serializer.validated_data.get('business')
        if business.owner == self.request.user:
            serializer.save()
        else:
            raise PermissionDenied("Vous n'êtes pas le propriétaire de cette entreprise.")

class ApplyToOfferView(generics.CreateAPIView):
    """
    Permet à un utilisateur (PROFESSIONAL etc.) de postuler à une offre
    """
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        offer_id = self.kwargs.get('pk')
        offer = get_object_or_404(Offer, id=offer_id)
        
        if Application.objects.filter(offer=offer, applicant=self.request.user).exists():
            raise ValidationError("Vous avez déjà postulé à cette offre.")
            
        serializer.save(applicant=self.request.user, offer=offer)

class MyBusinessOfferApplicationsView(generics.ListAPIView):
    """
    Permet à l'entreprise de voir les candidatures pour ses offres.
    """
    serializer_class = ApplicationSerializer
    permission_classes = [CanManageOffers]

    def get_queryset(self):
        # On retourne toutes les candidatures pour les offres des entreprises de l'utilisateur
        return Application.objects.filter(offer__business__owner=self.request.user)
