from rest_framework import generics, status
from rest_framework.permissions import AllowAny, BasePermission
from django.db import transaction
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
    Permet le filtrage par localisation (province, commune, quartier).
    """
    serializer_class = BusinessSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Business.objects.filter(is_active=True, is_verified=True)
        province = self.request.query_params.get('province')
        commune = self.request.query_params.get('commune')
        quartier = self.request.query_params.get('quartier')

        if province:
            queryset = queryset.filter(province__iexact=province.strip())
        if commune:
            queryset = queryset.filter(commune__iexact=commune.strip())
        if quartier:
            queryset = queryset.filter(quartier__icontains=quartier.strip())
        return queryset

class BusinessDetailView(generics.RetrieveAPIView):
    """
    Endpoint public pour récupérer les détails d'une entreprise spécifique (ex: Hôpital).
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

from .models import BusinessEmployee, BusinessRole
from .serializers import BusinessEmployeeSerializer, BusinessRoleSerializer

class BusinessRoleListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessRoleSerializer
    permission_classes = [CanCreateBusiness]

    def get_queryset(self):
        business = self.request.user.businesses.first()
        if business:
            return BusinessRole.objects.filter(business=business)
        return BusinessRole.objects.none()

    def perform_create(self, serializer):
        business = self.request.user.businesses.first()
        serializer.save(business=business)

class BusinessRoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BusinessRoleSerializer
    permission_classes = [CanCreateBusiness]

    def get_queryset(self):
        business = self.request.user.businesses.first()
        if business:
            return BusinessRole.objects.filter(business=business)
        return BusinessRole.objects.none()

class BusinessEmployeeListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessEmployeeSerializer
    permission_classes = [CanCreateBusiness]

    def get_queryset(self):
        business = self.request.user.businesses.first()
        if business:
            return BusinessEmployee.objects.filter(business=business)
        return BusinessEmployee.objects.none()

    def create(self, request, *args, **kwargs):
        business = request.user.businesses.first()
        if not business:
            return Response({'detail': 'Vous ne possédez aucune entreprise.'}, status=status.HTTP_400_BAD_REQUEST)

        email = request.data.get('email')
        position = request.data.get('position', 'STAFF')

        role_id = request.data.get('role_id')

        if not email:
            return Response({'email': 'L\'email est requis.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            User = get_user_model()
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'email': 'Aucun utilisateur trouvé avec cet email.'}, status=status.HTTP_404_NOT_FOUND)

        if BusinessEmployee.objects.filter(business=business, user=user).exists():
            return Response({'detail': 'Cet utilisateur est déjà un employé.'}, status=status.HTTP_400_BAD_REQUEST)

        role = None
        if role_id:
            try:
                role = BusinessRole.objects.get(id=role_id, business=business)
            except BusinessRole.DoesNotExist:
                pass

        employee = BusinessEmployee.objects.create(business=business, user=user, position=position, role=role)
        serializer = self.get_serializer(employee)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
                province = row.get('province') or row.get('Province') or 'Bujumbura Mairie'
                commune = row.get('commune') or row.get('Commune') or ''
                quartier = row.get('quartier') or row.get('Quartier') or ''
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
                    province=province,
                    commune=commune,
                    quartier=quartier,
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

class PublicBusinessRegistrationView(APIView):
    """
    Endpoint public permettant l'inscription d'une nouvelle entreprise (Onboarding).
    Crée le compte utilisateur gérant et l'entreprise avec le statut 'PENDING'.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        data = request.data
        email = data.get('owner_email_input') or data.get('email')
        password = data.get('password')
        name = data.get('name')
        
        if not email or not password or not name:
            return Response({'error': 'Le nom de l\'entreprise, l\'email et le mot de passe sont obligatoires.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Vérification si le nom de l'entreprise existe déjà
        if Business.objects.filter(name__iexact=name).exists():
            return Response({'error': 'Une entreprise avec ce nom existe déjà.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Création ou récupération de l'utilisateur (Propriétaire)
        try:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'role': 'BUSINESS_OWNER',
                    'first_name': data.get('first_name', 'Admin'),
                    'last_name': data.get('last_name', name),
                    'is_active': True
                }
            )
            
            if created:
                user.set_password(password)
                user.save()
            else:
                # Si l'utilisateur existe déjà, on vérifie si le mot de passe correspond, sinon on refuse (sécurité basique)
                if not user.check_password(password):
                     return Response({'error': 'Un compte avec cet email existe déjà. Mot de passe incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

            # 3. Création de l'entreprise (Tenant)
            primary_cat_id = data.get('primary_category')
            primary_cat = None
            if primary_cat_id:
                try:
                    primary_cat = BusinessCategory.objects.get(id=primary_cat_id)
                except BusinessCategory.DoesNotExist:
                    pass

            business = Business.objects.create(
                name=name,
                owner=user,
                email=email,
                phone=data.get('phone', ''),
                address=data.get('address', ''),
                province=data.get('province', 'Bujumbura Mairie'),
                commune=data.get('commune', ''),
                quartier=data.get('quartier', ''),
                latitude=data.get('latitude', None) or None,
                longitude=data.get('longitude', None) or None,
                website=data.get('website', ''),
                description=data.get('description', ''),
                primary_category=primary_cat,
                extra_attributes=data.get('extra_attributes', {}),
                verification_status='PENDING',
                is_verified=False,
                is_active=False
            )

            # Gestion du Logo
            logo_data = data.get('logo')
            if logo_data and logo_data.startswith('http'):
                # Simple URL binding (If you are using CharField or similar for logo URL in the future)
                pass

            # Catégories secondaires
            cat_ids = data.get('category_ids', [])
            if cat_ids:
                business.categories.set(cat_ids)

            return Response({
                'message': 'Votre entreprise a été soumise avec succès. Elle est en attente de validation.',
                'business_id': business.id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

