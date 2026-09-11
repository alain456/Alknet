from django.db.models import Q, Exists, OuterRef
from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import BusinessCategory
from .serializers import BusinessCategorySerializer


class BusinessCategoryListView(generics.ListAPIView):
    """
    Liste des catégories.
    Query params:
      - used=1 : uniquement les catégories déjà rattachées à au moins une entreprise active/vérifiée
      - parents_only=1 : uniquement les catégories racines (sans parent)
    """
    serializer_class = BusinessCategorySerializer
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = BusinessCategory.objects.all().order_by('name')
        used = self.request.query_params.get('used', '').lower() in ('1', 'true', 'yes')
        parents_only = self.request.query_params.get('parents_only', '').lower() in ('1', 'true', 'yes')

        if used:
            from businesses.models import Business
            linked = Business.objects.filter(
                is_active=True,
                is_verified=True,
            ).filter(
                Q(primary_category_id=OuterRef('pk'))
                | Q(category_id=OuterRef('pk'))
                | Q(categories__id=OuterRef('pk'))
            )
            qs = qs.filter(Exists(linked)).distinct()

        if parents_only:
            qs = qs.filter(parent__isnull=True)

        return qs


class BusinessCategoryCreateView(generics.CreateAPIView):
    queryset = BusinessCategory.objects.all()
    serializer_class = BusinessCategorySerializer
    authentication_classes = []
    permission_classes = [AllowAny]


class BusinessCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BusinessCategory.objects.all()
    serializer_class = BusinessCategorySerializer
    authentication_classes = []
    permission_classes = [AllowAny]
