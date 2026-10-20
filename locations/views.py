from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from permissions.custom_permissions import PlatformMethodPermission

from .models import Province, Commune, Zone, Quartier, Avenue
from .serializers import (
    ProvinceSerializer, CommuneSerializer, ZoneSerializer,
    QuartierSerializer, AvenueSerializer
)


class IsLocationCatalogWrite(PlatformMethodPermission):
    """Référentiel géo public en lecture ; écriture réservée à la plateforme.

    Ces données alimentent tous les formulaires d'adresse : les laisser
    ouvertes à un anonyme permet de corrompre le référentiel national.
    """

    WRITE_PERMISSION = 'platform.catalog.update'

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        from accounts.platform_access import user_has_platform_perm
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user_has_platform_perm(user, self.WRITE_PERMISSION)


# Tree View for LocationSelector frontend
class LocationTreeAPIView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        provinces = Province.objects.filter(is_active=True).prefetch_related('communes__zones__quartiers__avenues')
        serializer = ProvinceSerializer(provinces, many=True)
        return Response(serializer.data)

# Provinces CRUD
class ProvinceListCreateView(generics.ListCreateAPIView):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    permission_classes = [IsLocationCatalogWrite]

class ProvinceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    permission_classes = [IsLocationCatalogWrite]

# Communes CRUD
class CommuneListCreateView(generics.ListCreateAPIView):
    queryset = Commune.objects.all()
    serializer_class = CommuneSerializer
    permission_classes = [IsLocationCatalogWrite]

    def get_queryset(self):
        queryset = Commune.objects.all()
        province_id = self.request.query_params.get('province')
        if province_id:
            queryset = queryset.filter(province_id=province_id)
        return queryset

class CommuneDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Commune.objects.all()
    serializer_class = CommuneSerializer
    permission_classes = [IsLocationCatalogWrite]

# Zones CRUD
class ZoneListCreateView(generics.ListCreateAPIView):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer
    permission_classes = [IsLocationCatalogWrite]

    def get_queryset(self):
        queryset = Zone.objects.all()
        commune_id = self.request.query_params.get('commune')
        if commune_id:
            queryset = queryset.filter(commune_id=commune_id)
        return queryset

class ZoneDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer
    permission_classes = [IsLocationCatalogWrite]

# Quartiers CRUD
class QuartierListCreateView(generics.ListCreateAPIView):
    queryset = Quartier.objects.all()
    serializer_class = QuartierSerializer
    permission_classes = [IsLocationCatalogWrite]

    def get_queryset(self):
        queryset = Quartier.objects.all()
        zone_id = self.request.query_params.get('zone')
        if zone_id:
            queryset = queryset.filter(zone_id=zone_id)
        return queryset

class QuartierDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Quartier.objects.all()
    serializer_class = QuartierSerializer
    permission_classes = [IsLocationCatalogWrite]

# Avenues CRUD
class AvenueListCreateView(generics.ListCreateAPIView):
    queryset = Avenue.objects.all()
    serializer_class = AvenueSerializer
    permission_classes = [IsLocationCatalogWrite]

    def get_queryset(self):
        queryset = Avenue.objects.all()
        quartier_id = self.request.query_params.get('quartier')
        if quartier_id:
            queryset = queryset.filter(quartier_id=quartier_id)
        return queryset

class AvenueDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Avenue.objects.all()
    serializer_class = AvenueSerializer
    permission_classes = [IsLocationCatalogWrite]

# Initial Burundi Data Seeder (Province -> Commune -> Zone -> Quartier -> Avenue)
BURUNDI_INITIAL_SEED = {
  "Bujumbura Mairie": {
    "code": "BJM",
    "communes": {
      "Mukaza": {
        "Rohero": {
          "Rohero I": ["Boulevard de l'Uprona", "Avenue de la Croix Rouge", "Avenue de la Mission"],
          "Rohero II": ["Avenue du Commerce", "Avenue de l'Université"],
          "Centre-Ville": ["Avenue du Stade", "Boulevard de l'Indépendance"]
        },
        "Bwiza": {
          "Bwiza I": ["Avenue de l'Imprimerie"],
          "Bwiza II": ["Avenue de l'Amitié"]
        },
        "Buyenzi": {
          "Buyenzi I": ["1ère Avenue", "2ème Avenue", "3ème Avenue"],
          "Buyenzi II": ["4ème Avenue", "5ème Avenue"]
        },
        "Nyakabiga": {
          "Nyakabiga I": ["Avenue de la Mort"],
          "Nyakabiga II": ["Avenue de l'Université"]
        }
      },
      "Ntahangwa": {
        "Ngagara": {
          "Ngagara Q1": ["Chaussée d'Uvira"],
          "Ngagara Q2": ["Avenue du Progrès"],
          "Ngagara Q3": ["Avenue des Jeunes"]
        },
        "Kinama": {
          "Kinama Center": ["Avenue des Pigeons"]
        },
        "Kamenge": {
          "Mirango": ["Avenue Mirango"]
        },
        "Gihosha": {
          "Kigobe": ["Avenue de l'Hôpital"]
        }
      },
      "Muha": {
        "Kinindo": {
          "Kinindo Sud": ["Avenue du Large", "Avenue Ntambiriza"],
          "Kinindo Ouest": ["Avenue du Lac"]
        },
        "Kanyosha": {
          "Musaga": ["Avenue Ntahangwa"]
        }
      }
    }
  },
  "Gitega": {
    "code": "GTG",
    "communes": {
      "Gitega": {
        "Urban": {
          "Centre-Ville": ["Avenue du Marché", "Boulevard du 28 Novembre"],
          "Shatanya": ["Avenue de la Résidence"],
          "Nyamugari": ["Avenue Nyamugari"]
        }
      }
    }
  }
}

class SeedLocationsAPIView(APIView):
    permission_classes = [IsLocationCatalogWrite]

    def post(self, request):
        created_provinces = 0
        created_communes = 0
        created_zones = 0
        created_quartiers = 0
        created_avenues = 0

        for prov_name, data in BURUNDI_INITIAL_SEED.items():
            province, p_created = Province.objects.get_or_create(
                name=prov_name,
                defaults={'code': data.get('code', '')}
            )
            if p_created:
                created_provinces += 1

            for com_name, zones_dict in data.get('communes', {}).items():
                commune, c_created = Commune.objects.get_or_create(
                    province=province,
                    name=com_name
                )
                if c_created:
                    created_communes += 1

                for z_name, quartiers_dict in zones_dict.items():
                    zone, z_created = Zone.objects.get_or_create(
                        commune=commune,
                        name=z_name
                    )
                    if z_created:
                        created_zones += 1

                    for q_name, avenues_list in quartiers_dict.items():
                        quartier, q_created = Quartier.objects.get_or_create(
                            zone=zone,
                            name=q_name
                        )
                        if q_created:
                            created_quartiers += 1

                        for av_name in avenues_list:
                            avenue, av_created = Avenue.objects.get_or_create(
                                quartier=quartier,
                                name=av_name
                            )
                            if av_created:
                                created_avenues += 1

        return Response({
            'message': f"Initialisation réussie ! {created_provinces} provinces, {created_communes} communes, {created_zones} zones, {created_quartiers} quartiers, et {created_avenues} avenues créées."
        }, status=status.HTTP_200_OK)


def maps_link(request):
    """Extrait la latitude et la longitude d'un lien Google Maps, y compris un lien court."""
    from django.http import JsonResponse

    from .maps_link import resolve_maps_link

    raw = (request.GET.get('url') or '').strip()
    if not raw:
        return JsonResponse({'detail': 'Collez un lien Google Maps.'}, status=400)
    try:
        found = resolve_maps_link(raw)
    except ValueError as exc:
        return JsonResponse({'detail': str(exc)}, status=400)
    except Exception:
        return JsonResponse(
            {'detail': 'Ce lien court n’a pas pu être lu. Collez l’adresse complète de Google Maps.'},
            status=503,
        )
    if not found:
        return JsonResponse(
            {'detail': 'Aucune coordonnée dans ce lien. Ouvrez le lieu puis copiez l’adresse du navigateur.'},
            status=422,
        )
    latitude, longitude = found
    return JsonResponse({'latitude': latitude, 'longitude': longitude})


def map_tile(request, z, x, y):
    """Sert une tuile OpenStreetMap depuis notre domaine.

    Le navigateur n'autorise que les images du site (`img-src 'self'`).
    Une image chargée depuis tile.openstreetmap.org est donc bloquée.
    """
    import urllib.error
    import urllib.request

    from django.core.cache import cache
    from django.http import HttpResponse, HttpResponseBadRequest

    try:
        zoom, col, row = int(z), int(x), int(y)
    except (TypeError, ValueError):
        return HttpResponseBadRequest('Tuile invalide.')
    if not 0 <= zoom <= 19 or col < 0 or row < 0 or col >= 2 ** zoom or row >= 2 ** zoom:
        return HttpResponseBadRequest('Tuile invalide.')
    cache_key = f'map-tile:{zoom}:{col}:{row}'
    content = cache.get(cache_key)
    if content is None:
        upstream = f'https://tile.openstreetmap.org/{zoom}/{col}/{row}.png'
        request_up = urllib.request.Request(
            upstream,
            headers={'User-Agent': 'IsokoHub/1.0 (education map; contact info.isokohub@gmail.com)'},
        )
        try:
            with urllib.request.urlopen(request_up, timeout=20) as upstream_response:
                content = upstream_response.read()
        except (urllib.error.URLError, TimeoutError, OSError):
            return HttpResponse('Carte indisponible.', status=502, content_type='text/plain')
        cache.set(cache_key, content, 60 * 60 * 24)
    response = HttpResponse(content, content_type='image/png')
    response['Cache-Control'] = 'public, max-age=86400'
    return response
