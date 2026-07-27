from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model

User = get_user_model()

class RoleListView(APIView):
    """
    API endpoint pour récupérer la liste des rôles disponibles.
    Utile pour le frontend lors de l'inscription ou de la gestion des utilisateurs.
    """
    permission_classes = (AllowAny,)

    def get(self, request):
        # ROLE_CHOICES est un tuple de tuples (ex: ('CUSTOMER', 'Customer'))
        roles = [{"code": code, "name": name} for code, name in User.ROLE_CHOICES]
        return Response(roles)
