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
            Q(name__icontains=token)
            | Q(description__icontains=token)
            | Q(primary_category__name__icontains=token)
            | Q(province__icontains=token)
            | Q(commune__icontains=token)
        )
    return cond


def _href_for_business(business) -> str:
    cat = fold(business.primary_category.name if business.primary_category_id else '')
    name = fold(business.name)
    blob = f'{cat} {name}'
    bid = str(business.id)
    if any(k in blob for k in ('hotel', 'hotellerie')):
        return f'/hotels/{bid}'
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


def search_catalog(q: str, location: str = '', limit: int = 12) -> dict:
    from businesses.models import Business
    from hospital.models import DoctorProfile
    from products.models import Product
    from retail.models import RetailProduct
    from services.models import Service
    from wholesale.models import WholesaleProduct

    tokens, loc = split_query(q, location)
    if not tokens and not loc:
        return {'q': q, 'location': loc, 'tokens': [], 'groups': _empty_groups()}

    businesses = []
    bqs = Business.objects.filter(is_active=True, verification_status='APPROVED').select_related('primary_category')
    if tokens:
        bqs = bqs.filter(_token_q_business(tokens))
    if loc:
        bqs = bqs.filter(_place_q(loc))
    for biz in bqs[:80]:
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

    products = []
    pqs = Product.objects.filter(is_active=True, business__is_active=True, business__verification_status='APPROVED').select_related('business', 'business__primary_category')
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= Q(name__icontains=token) | Q(description__icontains=token) | Q(business__name__icontains=token)
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

    for retail in _pharmacy_products(RetailProduct, 'retail_business', tokens, loc)[:40]:
        products.append(retail)
    for wholesale in _pharmacy_products(WholesaleProduct, 'wholesale_business', tokens, loc)[:40]:
        products.append(wholesale)

    services = []
    sqs = Service.objects.filter(status='ACTIVE').select_related('business', 'category', 'professional')
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= Q(title__icontains=token) | Q(description__icontains=token) | Q(category__name__icontains=token)
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
            'href': '/services' if not svc.business_id else f'/services',
        })

    professionals = []
    dqs = DoctorProfile.objects.filter(is_active=True, hospital__is_active=True, hospital__verification_status='APPROVED').select_related('user', 'hospital').prefetch_related('specialties')
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= (
                Q(user__first_name__icontains=token)
                | Q(user__last_name__icontains=token)
                | Q(specialties__name__icontains=token)
                | Q(hospital__name__icontains=token)
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
            cond |= Q(title__icontains=token) | Q(domain__icontains=token) | Q(business__name__icontains=token)
        pqs = pqs.filter(cond)
        if loc:
            pqs = pqs.filter(Q(business__province__icontains=loc) | Q(business__commune__icontains=loc))
        for program in pqs[:40]:
            hay = f'{program.title} {program.domain} {program.degree_awarded} {program.business.name}'
            programs.append({
                'kind': 'service',
                'id': str(program.id),
                'title': program.title,
                'subtitle': program.business.name,
                'location': ', '.join(p for p in [program.business.commune, program.business.province] if p),
                'score': _score_text(hay, tokens or [fold(loc)], loc),
                'href': f'/education/establishment/{program.business_id}',
            })

    def top(rows):
        rows = [r for r in rows if r['score'] > 0]
        rows.sort(key=lambda r: r['score'], reverse=True)
        return rows[:limit]

    return {
        'q': q,
        'location': loc,
        'tokens': tokens,
        'groups': {
            'businesses': top(businesses),
            'products': top(products),
            'services': top(services + programs),
            'professionals': top(professionals),
        },
    }


def _pharmacy_products(model, fk, tokens, loc):
    qs = model.objects.filter(status='ACTIVE').select_related(fk)
    if tokens:
        cond = Q()
        for token in tokens:
            cond |= Q(name__icontains=token) | Q(active_ingredient__icontains=token) | Q(**{f'{fk}__name__icontains': token})
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
    return rows


def suggest(q: str, limit: int = 8) -> list[dict]:
    from businesses.models import Business
    from locations.models import Province

    text = fold(q)
    if len(text) < 2:
        return []
    rows = []
    for biz in Business.objects.filter(is_active=True, verification_status='APPROVED', name__icontains=q).only('id', 'name', 'province')[:limit]:
        rows.append({'kind': 'business', 'label': biz.name, 'location': biz.province, 'q': biz.name})
    for prov in Province.objects.filter(is_active=True, name__icontains=q).only('name')[:4]:
        rows.append({'kind': 'location', 'label': prov.name, 'location': prov.name, 'q': ''})
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
        return Response(search_catalog(q, location))


class PublicSearchSuggestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        q = request.query_params.get('q') or ''
        return Response(suggest(q))
