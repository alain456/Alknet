"""Recherche publique sans IA : synonymes, lieu, classement sur les fiches réelles."""
from __future__ import annotations

import re
import unicodedata

from django.db.models import Q

STOPWORDS = {
    'je', 'tu', 'cherche', 'chercher', 'recherche', 'trouver', 'trouve', 'moi',
    'un', 'une', 'des', 'de', 'du', 'la', 'le', 'les', 'pour', 'avec', 'sur',
    'dans', 'au', 'aux', 'a', 'à', 'et', 'ou', 'qui', 'que', 'mon', 'ma', 'mes',
    'the', 'a', 'an', 'find', 'looking', 'for', 'in', 'at', 'me', 'my', 'of',
}

# Mot saisi → autres formes à chercher (catégories / métiers déjà en base).
SYNONYMS = {
    'restaurant': ['restaurant', 'resto', 'restauration', 'cafe', 'café', 'snack', 'bar'],
    'hotel': ['hotel', 'hôtel', 'hotellerie', 'hôtellerie', 'chambre', 'hebergement', 'hébergement'],
    'hopital': ['hopital', 'hôpital', 'clinique', 'medecin', 'médecin', 'docteur', 'sante', 'santé'],
    'pharmacie': ['pharmacie', 'medicament', 'médicament', 'officine'],
    'construction': ['construction', 'macon', 'maçon', 'architecte', 'plombier', 'electricien', 'électricien', 'batiment', 'bâtiment'],
    'commerce': ['boutique', 'magasin', 'produit', 'commerce', 'shop'],
    'education': ['universite', 'université', 'ecole', 'école', 'formation', 'etudiant', 'étudiant'],
}

LOCATION_HINTS = ('à', 'a', 'au', 'aux', 'in', 'dans')


def fold(text: str) -> str:
    raw = unicodedata.normalize('NFKD', text or '')
    return ''.join(c for c in raw if not unicodedata.combining(c)).lower().strip()


def french_needles(token: str) -> list[str]:
    """Formes à passer à ILIKE : « ecole » trouve aussi « École »."""
    base = fold(token)
    if not base:
        return []
    found = {base}
    swaps = {'e': ('é', 'è', 'ê'), 'a': ('à', 'â'), 'o': ('ô',), 'u': ('ù', 'û'), 'i': ('î', 'ï'), 'c': ('ç',)}
    for index, char in enumerate(base):
        for accented in swaps.get(char, ()):
            found.add(base[:index] + accented + base[index + 1:])
    return list(found)


def field_contains(field: str, token: str) -> Q:
    cond = Q()
    for needle in french_needles(token):
        cond |= Q(**{f'{field}__icontains': needle})
    return cond


def expand_tokens(words: list[str]) -> list[str]:
    folded = [fold(w) for w in words if fold(w)]
    extra = []
    for word in folded:
        for group in SYNONYMS.values():
            if word in {fold(g) for g in group}:
                extra.extend(fold(g) for g in group)
    seen = []
    for token in folded + extra:
        if token and token not in seen:
            seen.append(token)
    return seen


def split_query(q: str, location: str = '') -> tuple[list[str], str]:
    text = (q or '').strip()
    loc = (location or '').strip()
    if not loc:
        match = re.search(r'\b(?:à|a|au|aux|in|dans)\s+([A-Za-zÀ-ÿ][\wÀ-ÿ\'\- ]{1,40})$', text, re.I)
        if match:
            loc = match.group(1).strip(' ,.')
            text = text[:match.start()].strip()
    words = [
        w for w in re.findall(r"[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'\-]{1,}", text)
        if fold(w) not in STOPWORDS
    ]
    return expand_tokens(words), loc


def _score_text(hay: str, tokens: list[str], location: str) -> int:
    blob = fold(hay)
    if not blob:
        return 0
    score = 0
    for token in tokens:
        if not token:
            continue
        if blob == token:
            score += 40
        elif blob.startswith(token):
            score += 28
        elif token in blob:
            score += 16
    if location and fold(location) in blob:
        score += 30
    return score


def _origin(lat, lng):
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat_f <= 90 and -180 <= lng_f <= 180):
        return None
    return lat_f, lng_f


def _distance_km(lat1, lng1, lat2, lng2) -> float:
    from math import asin, cos, radians, sin, sqrt

    lat1, lng1, lat2, lng2 = map(radians, (lat1, lng1, lat2, lng2))
    hav = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(hav))


def _apply_near(row: dict, origin, lat, lng) -> dict:
    if not origin or lat is None or lng is None:
        return row
    km = _distance_km(origin[0], origin[1], float(lat), float(lng))
    if km <= 5:
        row['score'] += 50
    elif km <= 15:
        row['score'] += 35
    elif km <= 40:
        row['score'] += 18
    elif km <= 80:
        row['score'] += 8
    shown = 1 if km < 1 else round(km)
    suffix = 'moins d’1 km' if km < 1 else f'{shown} km'
    row['distance_km'] = round(km, 1)
    row['location'] = f"{row.get('location') or ''} · {suffix}".strip(' ·')
    return row


def _place_q(location: str) -> Q:
    loc = location.strip()
    return (
        Q(province__icontains=loc)
        | Q(commune__icontains=loc)
        | Q(zone__icontains=loc)
        | Q(quartier__icontains=loc)
        | Q(address__icontains=loc)
    )


def _token_q_business(tokens: list[str]) -> Q:
    cond = Q()
    for token in tokens:
        cond |= (
            field_contains('name', token)
            | field_contains('description', token)
            | field_contains('primary_category__name', token)
            | field_contains('province', token)
            | field_contains('commune', token)
        )
    return cond


def _href_for_business(business) -> str:
    from hotel.lodging import is_food_service_category, is_lodging_business

    cat = fold(business.primary_category.name if business.primary_category_id else '')
    name = fold(business.name)
    blob = f'{cat} {name}'
    bid = str(business.id)
    if is_lodging_business(business):
        return f'/hotels/{bid}'
    if is_food_service_category(business.primary_category):
        return f'/restaurants/{bid}'
    if any(k in blob for k in ('hopital', 'clinique', 'sante', 'medical')):
        return f'/hospitals/{bid}'
    if 'detail' in blob or 'pharmacie de detail' in blob or ('pharmac' in blob and 'gros' not in blob):
        return f'/businesses/{bid}/pharmacy'
    if 'gros' in blob:
        return f'/businesses/{bid}/catalog'
    if any(k in blob for k in ('universite', 'ecole', 'education', 'formation', 'cours particulier')):
        return f'/education/establishment/{bid}'
    if any(k in blob for k in ('boutique', 'commerce', 'mode', 'quincaillerie')):
        return f'/businesses/{bid}/shop'
    return f'/businesses?q={bid}'


def search_catalog(q: str, location: str = '', limit: int = 12, near_lat=None, near_lng=None) -> dict:
    from businesses.models import Business
    from hospital.models import DoctorProfile
    from products.models import Product
    from retail.models import RetailProduct
    from services.models import Service
    from wholesale.models import WholesaleProduct

    tokens, loc = split_query(q, location)
    origin = None if loc else _origin(near_lat, near_lng)
    if not tokens and not loc:
        return {'q': q, 'location': loc, 'near': bool(origin), 'tokens': [], 'groups': _empty_groups()}

    businesses = []
    bqs = Business.objects.filter(is_active=True, verification_status='APPROVED').select_related('primary_category')
    if loc:
        bqs = bqs.filter(_place_q(loc))
    matched = list(bqs.filter(_token_q_business(tokens))[:80]) if tokens else list(bqs[:80])
    if tokens and len(matched) < 80:
        have = {biz.id for biz in matched}
        folded_tokens = [fold(token) for token in tokens]
        for biz in bqs.exclude(id__in=have).select_related('primary_category')[:400]:
            blob = fold(' '.join(filter(None, [
                biz.name, biz.description, biz.commune, biz.province,
                biz.primary_category.name if biz.primary_category_id else '',
            ])))
            if any(token in blob for token in folded_tokens):
                matched.append(biz)
                if len(matched) >= 80:
                    break
    for biz in matched:
        hay = ' '.join(filter(None, [
            biz.name, biz.description, biz.province, biz.commune, biz.quartier,
            biz.primary_category.name if biz.primary_category_id else '',
        ]))
        score = _score_text(hay, tokens or [fold(loc)], loc)
        if score <= 0 and tokens:
            continue
        businesses.append({
            'kind': 'business',
            'id': str(biz.id),
            'title': biz.name,
            'subtitle': biz.primary_category.name if biz.primary_category_id else 'Entreprise',
            'location': ', '.join(p for p in [biz.commune, biz.province] if p),
            'score': score + (5 if biz.is_verified else 0),
            'href': _href_for_business(biz),
        })
        _apply_near(businesses[-1], origin, biz.latitude, biz.longitude)

    products = []
    pqs = Product.objects.filter(is_active=True, business__is_active=True, business__verification_status='APPROVED').select_related('business', 'business__primary_category')
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= field_contains('name', token) | field_contains('description', token) | field_contains('business__name', token)
        pqs = pqs.filter(cond)
    if loc:
        pqs = pqs.filter(
            Q(business__province__icontains=loc)
            | Q(business__commune__icontains=loc)
            | Q(business__quartier__icontains=loc)
        )
    for product in pqs[:60]:
        hay = f'{product.name} {product.description} {product.business.name}'
        score = _score_text(hay, tokens or [fold(loc)], loc)
        products.append({
            'kind': 'product',
            'id': str(product.id),
            'title': product.name,
            'subtitle': product.business.name,
            'location': ', '.join(p for p in [product.business.commune, product.business.province] if p),
            'score': score,
            'href': f'/businesses/{product.business_id}/shop',
        })
        _apply_near(products[-1], origin, product.business.latitude, product.business.longitude)

    for retail in _pharmacy_products(RetailProduct, 'retail_business', tokens, loc, origin)[:40]:
        products.append(retail)
    for wholesale in _pharmacy_products(WholesaleProduct, 'wholesale_business', tokens, loc, origin)[:40]:
        products.append(wholesale)

    services = []
    sqs = Service.objects.filter(status='ACTIVE').select_related('business', 'category', 'professional')
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= field_contains('title', token) | field_contains('description', token) | field_contains('category__name', token)
        sqs = sqs.filter(cond)
    if loc:
        sqs = sqs.filter(
            Q(location__icontains=loc)
            | Q(business__province__icontains=loc)
            | Q(business__commune__icontains=loc)
        )
    for svc in sqs[:40]:
        place = svc.location or (svc.business.province if svc.business_id else '')
        hay = f'{svc.title} {svc.description} {svc.category.name if svc.category_id else ""} {place}'
        score = _score_text(hay, tokens or [fold(loc)], loc) + int(float(svc.reviews_count or 0) > 0)
        services.append({
            'kind': 'service',
            'id': str(svc.id),
            'title': svc.title,
            'subtitle': svc.business.name if svc.business_id else 'Professionnel',
            'location': place,
            'score': score,
            'href': _href_for_business(svc.business) if svc.business_id else '/services',
        })
        if svc.business_id:
            _apply_near(services[-1], origin, svc.business.latitude, svc.business.longitude)

    professionals = []
    dqs = DoctorProfile.objects.filter(is_active=True, hospital__is_active=True, hospital__verification_status='APPROVED').select_related('user', 'hospital').prefetch_related('specialties')
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= (
                field_contains('user__first_name', token)
                | field_contains('user__last_name', token)
                | field_contains('specialties__name', token)
                | field_contains('hospital__name', token)
            )
        dqs = dqs.filter(cond).distinct()
    if loc:
        dqs = dqs.filter(Q(hospital__province__icontains=loc) | Q(hospital__commune__icontains=loc))
    for doctor in dqs[:40]:
        specs = ', '.join(s.name for s in doctor.specialties.all()[:3])
        user = doctor.user
        title = f'{user.first_name} {user.last_name}'.strip() or user.email
        hay = f'{title} {specs} {doctor.hospital.name}'
        professionals.append({
            'kind': 'professional',
            'id': str(doctor.id),
            'title': title,
            'subtitle': specs or 'Professionnel de santé',
            'location': ', '.join(p for p in [doctor.hospital.commune, doctor.hospital.province] if p),
            'score': _score_text(hay, tokens or [fold(loc)], loc),
            'href': f'/hospitals/{doctor.hospital_id}',
        })
        _apply_near(professionals[-1], origin, doctor.hospital.latitude, doctor.hospital.longitude)

    programs = []
    if tokens:
        from education.models import EducationProgram, PublicationStatus
        pqs = EducationProgram.objects.filter(
            is_public=True, is_active=True,
            business__education_profile__publication_status=PublicationStatus.PUBLISHED,
            business__is_active=True,
        ).select_related('business')
        cond = Q()
        for token in tokens:
            cond |= field_contains('title', token) | field_contains('domain', token) | field_contains('business__name', token)
        pqs = pqs.filter(cond)
        if loc:
            pqs = pqs.filter(Q(business__province__icontains=loc) | Q(business__commune__icontains=loc))
        for program in pqs[:40]:
            hay = f'{program.title} {program.domain} {program.degree_awarded} {program.business.name}'
            programs.append({
                'kind': 'program',
                'id': str(program.id),
                'title': program.title,
                'subtitle': program.business.name,
                'location': ', '.join(p for p in [program.business.commune, program.business.province] if p),
                'score': _score_text(hay, tokens or [fold(loc)], loc),
                'href': f'/education/establishment/{program.business_id}',
            })
            _apply_near(programs[-1], origin, program.business.latitude, program.business.longitude)

    def top(rows):
        rows = [r for r in rows if r['score'] > 0]
        rows.sort(key=lambda r: r['score'], reverse=True)
        return rows[:limit]

    return {
        'q': q,
        'location': loc,
        'near': bool(origin),
        'tokens': tokens,
        'groups': {
            'businesses': top(businesses),
            'products': top(products),
            'services': top(services + programs),
            'professionals': top(professionals),
        },
    }


def _pharmacy_products(model, fk, tokens, loc, origin=None):
    qs = model.objects.filter(status='ACTIVE').select_related(fk)
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= field_contains('name', token) | field_contains('active_ingredient', token) | field_contains(f'{fk}__name', token)
        qs = qs.filter(cond)
    if loc:
        qs = qs.filter(Q(**{f'{fk}__province__icontains': loc}) | Q(**{f'{fk}__commune__icontains': loc}))
    rows = []
    for item in qs[:40]:
        biz = getattr(item, fk)
        path = 'pharmacy' if fk == 'retail_business' else 'catalog'
        hay = f'{item.name} {item.active_ingredient} {biz.name}'
        rows.append({
            'kind': 'product',
            'id': str(item.id),
            'title': item.name,
            'subtitle': biz.name,
            'location': ', '.join(p for p in [biz.commune, biz.province] if p),
            'score': _score_text(hay, tokens or [fold(loc)], loc),
            'href': f'/businesses/{biz.id}/{path}',
        })
        _apply_near(rows[-1], origin, biz.latitude, biz.longitude)
    return rows


def _location_rows(text: str, limit: int = 4) -> list[dict]:
    from locations.models import Commune, Province

    needle = fold(text)
    if len(needle) < 2:
        return []
    rows = []
    for prov in Province.objects.filter(is_active=True).only('name'):
        if needle in fold(prov.name):
            rows.append({'kind': 'location', 'label': prov.name, 'detail': 'Province', 'location': prov.name, 'href': '', 'q': prov.name})
    for commune in Commune.objects.filter(is_active=True).select_related('province').only('name', 'province__name'):
        if needle in fold(commune.name):
            province = commune.province.name if commune.province_id else ''
            rows.append({
                'kind': 'location',
                'label': commune.name,
                'detail': province or 'Commune',
                'location': province,
                'href': '',
                'q': commune.name,
            })
        if len(rows) >= limit:
            break
    return rows[:limit]


def suggest(q: str = '', place: str = '', limit: int = 8, near_lat=None, near_lng=None) -> list[dict]:
    if place and not (q or '').strip():
        return _location_rows(place, limit)
    text = fold(q)
    if len(text) < 2:
        return []
    catalog = search_catalog(q, limit=3, near_lat=near_lat, near_lng=near_lng)
    rows = []
    seen = set()
    for key in ('businesses', 'products', 'services', 'professionals'):
        for item in catalog['groups'][key]:
            marker = (item.get('kind'), item.get('id'))
            if marker in seen:
                continue
            seen.add(marker)
            rows.append({
                'kind': item.get('kind') or key[:-1],
                'label': item['title'],
                'detail': item.get('subtitle') or '',
                'location': item.get('location') or '',
                'href': item.get('href') or '',
                'q': item['title'],
            })
    for loc in _location_rows(q, 3):
        marker = ('location', loc['label'])
        if marker in seen:
            continue
        seen.add(marker)
        rows.append(loc)
    return rows[:limit]


def _empty_groups():
    return {'businesses': [], 'products': [], 'services': [], 'professionals': []}


from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class PublicSearchView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        q = request.query_params.get('q') or ''
        location = request.query_params.get('location') or ''
        return Response(search_catalog(
            q, location,
            near_lat=request.query_params.get('lat'),
            near_lng=request.query_params.get('lng'),
        ))


class PublicSearchSuggestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        q = request.query_params.get('q') or ''
        place = request.query_params.get('place') or ''
        return Response(suggest(
            q, place,
            near_lat=request.query_params.get('lat'),
            near_lng=request.query_params.get('lng'),
        ))
