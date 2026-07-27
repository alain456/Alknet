from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Profile
from .serializers import ProfileSerializer

class MyProfileView(generics.RetrieveUpdateAPIView):
    """
    Endpoint permettant à l'utilisateur connecté de récupérer et mettre à jour son profil.
    Méthodes supportées : GET, PUT, PATCH
    """
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # Retourne toujours le profil de l'utilisateur connecté
        return self.request.user.profile
