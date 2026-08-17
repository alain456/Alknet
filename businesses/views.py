from rest_framework import generics
from rest_framework.permissions import AllowAny, BasePermission
from .models import Business
from .serializers import BusinessSerializer, AdminBusinessSerializer

class CanCreateBusiness(BasePermission):
    """
    Vérifie si l'utilisateur a un rôle lui permettant de créer une entreprise.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed_roles = ['BUSINESS_OWNER', 'SUPER_ADMIN']
        return request.user.role in allowed_roles

class BusinessListView(generics.ListAPIView):
    """
    Endpoint public pour lister toutes les entreprises validées et actives.
    """
    queryset = Business.objects.filter(is_active=True, is_verified=True)
    serializer_class = BusinessSerializer
    permission_classes = [AllowAny]

class MyBusinessListView(generics.ListCreateAPIView):
    """
    Endpoint pour qu'un utilisateur puisse lister ses entreprises et en créer de nouvelles.
    """
    serializer_class = BusinessSerializer
    permission_classes = [CanCreateBusiness]

    def get_queryset(self):
        return Business.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # Assigne automatiquement l'utilisateur connecté comme propriétaire
        serializer.save(owner=self.request.user)

class AdminBusinessListView(generics.ListCreateAPIView):
    queryset = Business.objects.all().order_by('-created_at')
    serializer_class = AdminBusinessSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

class AdminBusinessDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Business.objects.all()
    serializer_class = AdminBusinessSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

from .models import BusinessEmployee
from .serializers import BusinessEmployeeSerializer

class BusinessEmployeeListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessEmployeeSerializer
    permission_classes = [AllowAny]

# --- VIEWS DE MODÉRATION ET IMPORTATION CSV ---
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from business_categories.models import BusinessCategory
from django.contrib.auth import get_user_model

User = get_user_model()

class AdminModerationListView(generics.ListAPIView):
    queryset = Business.objects.filter(verification_status='PENDING').order_by('-created_at')
    serializer_class = AdminBusinessSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

class AdminModerationApproveView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            business = Business.objects.get(pk=pk)
            business.verification_status = 'APPROVED'
            business.is_verified = True
            business.rejection_reason = ''
            business.save()
            return Response({'message': f'L\'entreprise "{business.name}" a été approuvée avec succès.'})
        except Business.DoesNotExist:
            return Response({'error': 'Entreprise introuvable'}, status=status.HTTP_404_NOT_FOUND)

class AdminModerationRejectView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            business = Business.objects.get(pk=pk)
            reason = request.data.get('reason', 'Non conforme aux exigences du secteur.')
            business.verification_status = 'REJECTED'
            business.is_verified = False
            business.rejection_reason = reason
            business.save()
            return Response({'message': f'L\'entreprise "{business.name}" a été rejetée.'})
        except Business.DoesNotExist:
            return Response({'error': 'Entreprise introuvable'}, status=status.HTTP_404_NOT_FOUND)

class AdminCSVImportView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        items = request.data.get('items', [])
        if not items:
            return Response({'error': 'Aucune donnée d\'entreprise fournie.'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []

        # Index existing categories by lowercase name for fast matching
        all_categories = {c.name.lower(): c for c in BusinessCategory.objects.all()}

        for idx, row in enumerate(items, start=1):
            try:
                name = row.get('name') or row.get('Nom')
                email = row.get('email') or row.get('Email')
                phone = row.get('phone') or row.get('Téléphone') or ''
                address = row.get('address') or row.get('Adresse') or ''
                sector_name = row.get('sector') or row.get('Secteur_Parent') or ''
                sub_cats = row.get('sub_categories') or row.get('Sous_Categories') or ''

                if not name or not email:
                    errors.append(f"Ligne {idx}: Nom et Email requis.")
                    continue

                # 1. User Creation/Get
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'role': 'BUSINESS_OWNER',
                        'first_name': name,
                        'is_active': True
                    }
                )
                if created:
                    user.set_password('Isoko123!')
                    user.save()

                # 2. Match Primary Category
                primary_cat = None
                if sector_name:
                    primary_cat = all_categories.get(sector_name.strip().lower())

                # 3. Create Business
                business = Business.objects.create(
                    name=name,
                    owner=user,
                    email=email,
                    phone=phone,
                    address=address,
                    primary_category=primary_cat,
                    is_active=True,
                    is_verified=True,
                    verification_status='APPROVED'
                )

                # 4. Secondary categories matching
                if sub_cats:
                    sub_list = [s.strip().lower() for s in sub_cats.split(',')]
                    matched_ids = []
                    for s_name in sub_list:
                        if s_name in all_categories:
                            matched_ids.append(all_categories[s_name].id)
                    if matched_ids:
                        business.categories.set(matched_ids)

                created_count += 1

            except Exception as e:
                errors.append(f"Ligne {idx} ({row.get('name', 'Inconnu')}): {str(e)}")

        return Response({
            'message': f"{created_count} entreprise(s) importée(s) avec succès.",
            'created_count': created_count,
            'errors': errors
        })

