"""Localisation dynamique à partir du référentiel `locations`.

Les zones et quartiers affichés près d'un établissement viennent du catalogue
administré (province → commune → zone → quartier), pas d'une liste figée.
"""

import math

from locations.models import Commune


def reference_areas(business, limit=8):
    """Zones et quartiers de la même commune, hors le quartier de l'établissement."""
    commune_name = (getattr(business, 'commune', '') or '').strip()
    if not commune_name:
        return []
    commune = (
        Commune.objects.filter(name__iexact=commune_name, is_active=True)
        .prefetch_related('zones__quartiers')
        .first()
    )
    if not commune:
        return []
    own_quartier = (getattr(business, 'quartier', '') or '').strip().lower()
    areas = []
    for zone in commune.zones.all():
        if not zone.is_active:
            continue
        quartiers = [
            q.name for q in zone.quartiers.all()
            if q.is_active and q.name.strip().lower() != own_quartier
        ]
        if not quartiers and (zone.name or '').strip().lower() == (getattr(business, 'zone', '') or '').strip().lower():
            continue
        areas.append({'zone': zone.name, 'quartiers': quartiers[:6]})
        if len(areas) >= limit:
            break
    return areas


def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lon / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(h)))


def road_distance(from_lat, from_lon, to_lat, to_lon):
    """Distance et durée par la route, calculées entre deux points GPS."""
    import json
    import urllib.request

    from django.core.cache import cache

    from config.feature_flags import enabled

    cache_key = (
        f'osrm:{round(float(from_lat), 4)}:{round(float(from_lon), 4)}:'
        f'{round(float(to_lat), 4)}:{round(float(to_lon), 4)}'
    )
    if enabled('OSRM_CACHE'):
        cached = cache.get(cache_key)
        if cached:
            return cached

    url = (
        'https://router.project-osrm.org/route/v1/driving/'
        f'{from_lon},{from_lat};{to_lon},{to_lat}?overview=false'
    )
    request = urllib.request.Request(url, headers={'User-Agent': 'IsokoHub/1.0'})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode())
    route = payload['routes'][0]
    result = {
        'distance_km': round(route['distance'] / 1000, 2),
        'duration_minutes': max(1, round(route['duration'] / 60)),
        'kind': 'driving',
    }
    if enabled('OSRM_CACHE'):
        cache.set(cache_key, result, 60 * 60)
    return result


def travel_minutes(distance_km):
    """Estimation urbaine à 25 km/h, quand aucun itinéraire routier n'est fourni."""
    if distance_km is None:
        return None
    return max(1, round((distance_km / 25) * 60))
