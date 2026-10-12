"""Années scolaires proposées selon les choix de l'admin école.

ECOFO : dérivées des cycles cochés.
Post-fondamental : années saisies par section.
Campagne : plan d'ouverture (années + places) fixé par l'admin.
"""

from django.core.exceptions import ValidationError

ECOFO_CYCLE_YEARS = {
    'C1': [1, 2],
    'C2': [3, 4],
    'C3': [5, 6],
    'C4': [7, 8, 9],
}

DEFAULT_POST_YEARS = [1, 2, 3]

TRACK_PRESCOLAIRE = 'PRESCOLAIRE'
TRACK_ECOFO = 'ECOFO'
TRACK_POST = 'POST_FONDAMENTAL'


def year_label(year):
    try:
        n = int(year)
    except (TypeError, ValueError):
        return str(year or '')
    if n == 1:
        return '1ère année'
    return f'{n}ème année'


def ecofo_years_from_cycles(cycles):
    years = []
    seen = set()
    for code in cycles or []:
        for year in ECOFO_CYCLE_YEARS.get(str(code), []):
            if year not in seen:
                seen.add(year)
                years.append(year)
    return years


def normalize_year_list(raw, fallback=None):
    out = []
    seen = set()
    for item in raw or []:
        try:
            year = int(item)
        except (TypeError, ValueError):
            continue
        if year < 1 or year > 12 or year in seen:
            continue
        seen.add(year)
        out.append(year)
    if not out and fallback is not None:
        return list(fallback)
    return sorted(out)


def normalize_class_list(raw, fallback=None):
    """Normalise une liste de classes : [{value, label}] (accepte aussi [1,2,3])."""
    out = []
    seen = set()
    for item in raw or []:
        if isinstance(item, dict):
            value = str(item.get('value') or '').strip()
            label = (item.get('label') or '').strip()
            if not value:
                continue
            if not label:
                label = year_label(value) if str(value).isdigit() else value
        else:
            try:
                value = str(int(item))
            except (TypeError, ValueError):
                value = str(item or '').strip()
            if not value:
                continue
            label = year_label(value) if value.isdigit() else value
        if value in seen:
            continue
        seen.add(value)
        out.append({'value': value, 'label': label})
    if not out and fallback is not None:
        return normalize_class_list(fallback, None)
    return out


def section_years(section):
    """Années / classes ouvertes pour une section post-fondamental (valeurs)."""
    if not isinstance(section, dict):
        return [str(y) for y in DEFAULT_POST_YEARS]
    classes = normalize_class_list(
        section.get('classes') or section.get('years'),
        DEFAULT_POST_YEARS,
    )
    return [row['value'] for row in classes]


def section_classes(section):
    """Classes post-fondamental avec libellés."""
    if not isinstance(section, dict):
        return normalize_class_list(DEFAULT_POST_YEARS)
    return normalize_class_list(
        section.get('classes') or section.get('years'),
        DEFAULT_POST_YEARS,
    )


def ecofo_classes_for_profile(profile):
    """Classes ECOFO dynamiques (CRUD admin), avec repli sur les cycles legacy."""
    if not profile:
        return []
    classes = normalize_class_list(getattr(profile, 'ecofo_classes', None) or [])
    if classes:
        return classes
    return [
        {'value': str(year), 'label': year_label(year)}
        for year in ecofo_years_from_cycles(getattr(profile, 'ecofo_cycles', None) or [])
    ]


def enrollment_options_for_profile(profile):
    """Options de base (fiche école) — catalogue possible."""
    if not profile:
        return {'ecofo_years': [], 'post_sections': [], 'prescolaire_seats': None}
    ecofo = ecofo_classes_for_profile(profile)
    sections = []
    for section in (profile.post_fondamental_sections or []):
        if not isinstance(section, dict):
            continue
        name = (section.get('name') or '').strip()
        if not name:
            continue
        sections.append({
            'name': name,
            'orientation': section.get('orientation') or '',
            'years': section_classes(section),
        })
    return {'ecofo_years': ecofo, 'post_sections': sections, 'prescolaire_seats': None}


def _plan_rows(plan):
    return [row for row in (plan or []) if isinstance(row, dict)]


def normalize_enrollment_plan(raw):
    """Normalise le plan campagne : une ligne = parcours + année (+ section) + places."""
    out = []
    seen = set()
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        track = str(item.get('track') or '').strip()
        if track not in {TRACK_PRESCOLAIRE, TRACK_ECOFO, TRACK_POST}:
            continue
        year = str(item.get('year') or '').strip()
        section = str(item.get('section') or '').strip()
        try:
            seats = int(item.get('seats'))
        except (TypeError, ValueError):
            continue
        if seats < 1:
            continue
        if track == TRACK_PRESCOLAIRE:
            year = ''
            section = ''
        elif track == TRACK_ECOFO:
            if not year:
                continue
            section = ''
        elif track == TRACK_POST:
            if not year or not section:
                continue
        key = (track, year, section)
        if key in seen:
            continue
        seen.add(key)
        out.append({
            'track': track,
            'year': year,
            'section': section,
            'seats': seats,
        })
    return out


def open_tracks_from_plan(plan):
    order = [TRACK_PRESCOLAIRE, TRACK_ECOFO, TRACK_POST]
    found = {row['track'] for row in _plan_rows(plan)}
    return [code for code in order if code in found]


def validate_enrollment_plan_against_profile(plan, profile):
    """Vérifie que le plan ne dépasse pas ce que la fiche école propose."""
    from .school_enrollment_docs import offered_tracks

    plan = normalize_enrollment_plan(plan)
    if not plan:
        raise ValidationError({
            'enrollment_plan': 'Ajoutez au moins une année ouverte avec un nombre de places.',
        })
    allowed = set(offered_tracks(profile))
    options = enrollment_options_for_profile(profile)
    ecofo_ok = {row['value'] for row in options['ecofo_years']}
    sections = {row['name']: {y['value'] for y in row['years']} for row in options['post_sections']}

    for row in plan:
        track = row['track']
        if track not in allowed:
            raise ValidationError({
                'enrollment_plan': f'Parcours non proposé par l’école : {track}.',
            })
        if track == TRACK_ECOFO and row['year'] not in ecofo_ok:
            raise ValidationError({
                'enrollment_plan': f'Année ECOFO non disponible sur la fiche : {row["year"]}.',
            })
        if track == TRACK_POST:
            if row['section'] not in sections:
                raise ValidationError({
                    'enrollment_plan': f'Section inconnue : {row["section"]}.',
                })
            if row['year'] not in sections[row['section']]:
                raise ValidationError({
                    'enrollment_plan': (
                        f'Année {row["year"]} non ouverte pour la section {row["section"]}.'
                    ),
                })
    return plan


def enrollment_options_for_campaign(campaign, profile=None):
    """Options élève = plan de la campagne (sinon fallback fiche école)."""
    profile = profile or getattr(getattr(campaign, 'business', None), 'education_profile', None)
    plan = normalize_enrollment_plan(getattr(campaign, 'enrollment_plan', None) or [])
    if not plan:
        return enrollment_options_for_profile(profile)

    ecofo = []
    seen_ecofo = set()
    sections_map = {}
    prescolaire_seats = None

    for row in plan:
        track = row['track']
        if track == TRACK_PRESCOLAIRE:
            prescolaire_seats = row['seats']
        elif track == TRACK_ECOFO:
            if row['year'] not in seen_ecofo:
                seen_ecofo.add(row['year'])
                ecofo.append({
                    'value': row['year'],
                    'label': year_label(row['year']),
                    'seats': row['seats'],
                })
        elif track == TRACK_POST:
            bucket = sections_map.setdefault(row['section'], {
                'name': row['section'],
                'orientation': '',
                'years': [],
            })
            if not any(item['value'] == row['year'] for item in bucket['years']):
                bucket['years'].append({
                    'value': row['year'],
                    'label': year_label(row['year']),
                    'seats': row['seats'],
                })

    if profile:
        base = enrollment_options_for_profile(profile)
        orient = {row['name']: row.get('orientation') or '' for row in base['post_sections']}
        for name, bucket in sections_map.items():
            bucket['orientation'] = orient.get(name, '')

    ecofo.sort(key=lambda row: int(row['value']) if str(row['value']).isdigit() else 99)
    for bucket in sections_map.values():
        bucket['years'].sort(key=lambda row: int(row['value']) if str(row['value']).isdigit() else 99)

    return {
        'ecofo_years': ecofo,
        'post_sections': list(sections_map.values()),
        'prescolaire_seats': prescolaire_seats,
    }


def find_plan_row(campaign, track, ecofo_year='', post_section='', post_year=''):
    plan = normalize_enrollment_plan(getattr(campaign, 'enrollment_plan', None) or [])
    if not plan:
        return None
    track = (track or '').strip()
    ecofo_year = (ecofo_year or '').strip()
    post_section = (post_section or '').strip()
    post_year = (post_year or '').strip()
    for row in plan:
        if row['track'] != track:
            continue
        if track == TRACK_PRESCOLAIRE:
            return row
        if track == TRACK_ECOFO and row['year'] == ecofo_year:
            return row
        if track == TRACK_POST and row['section'] == post_section and row['year'] == post_year:
            return row
    return None


def _slot_queryset(campaign, track, ecofo_year='', post_section='', post_year=''):
    from .models import EnrollmentApplication

    qs = EnrollmentApplication.objects.filter(campaign=campaign, track=track)
    if track == TRACK_ECOFO:
        qs = qs.filter(ecofo_year=ecofo_year)
    elif track == TRACK_POST:
        qs = qs.filter(post_section=post_section, post_year=post_year)
    return qs


def count_applications_for_slot(campaign, track, ecofo_year='', post_section='', post_year=''):
    """Seules les inscriptions acceptées tiennent une place."""
    return _slot_queryset(
        campaign, track, ecofo_year, post_section, post_year,
    ).filter(status__in=('ACCEPTEE', 'CONFIRMEE')).count()


def seat_summary_for_campaign(campaign):
    """Places tenues (hors refus) et acceptées, par classe du plan."""
    plan = normalize_enrollment_plan(getattr(campaign, 'enrollment_plan', None) or [])
    rows = []
    for row in plan:
        track = row['track']
        year = row.get('year') or ''
        section = row.get('section') or ''
        held = count_applications_for_slot(
            campaign, track,
            ecofo_year=year if track == TRACK_ECOFO else '',
            post_section=section if track == TRACK_POST else '',
            post_year=year if track == TRACK_POST else '',
        )
        slot = _slot_queryset(
            campaign, track,
            ecofo_year=year if track == TRACK_ECOFO else '',
            post_section=section if track == TRACK_POST else '',
            post_year=year if track == TRACK_POST else '',
        )
        accepted = slot.filter(status__in=('ACCEPTEE', 'CONFIRMEE')).count()
        waiting = slot.filter(status__in=(
            'LISTE_ATTENTE', 'ENVOYEE', 'EN_INSTRUCTION', 'COMPLEMENT_DEMANDE',
        )).count()
        if track == TRACK_PRESCOLAIRE:
            label = 'Maternelle / Préscolaire'
        elif track == TRACK_ECOFO:
            label = f'ECOFO · {year_label(year)}'
        else:
            label = f'{section} · {year_label(year)}'
        seats = int(row['seats'])
        rows.append({
            'track': track,
            'year': year,
            'section': section,
            'label': label,
            'seats': seats,
            'held': held,
            'accepted': accepted,
            'waiting': waiting,
            'remaining': max(0, seats - held),
        })
    return rows


def slot_is_full(campaign, track, ecofo_year='', post_section='', post_year=''):
    """True si le plan a un plafond et qu’il est atteint. Les refus et la liste d’attente ne tiennent pas de place."""
    row = find_plan_row(campaign, track, ecofo_year, post_section, post_year)
    if row is None:
        if not normalize_enrollment_plan(getattr(campaign, 'enrollment_plan', None) or []):
            return False
        raise ValidationError({
            'track': 'Cette année / section n’est pas ouverte pour les inscriptions.',
        })
    used = count_applications_for_slot(
        campaign, track, ecofo_year, post_section, post_year,
    )
    return used >= int(row['seats'])


def assert_seats_available(campaign, track, ecofo_year='', post_section='', post_year=''):
    row = find_plan_row(campaign, track, ecofo_year, post_section, post_year)
    if row is None:
        # Anciennes campagnes sans plan : pas de plafond.
        if not normalize_enrollment_plan(getattr(campaign, 'enrollment_plan', None) or []):
            return None
        raise ValidationError({
            'track': 'Cette année / section n’est pas ouverte pour les inscriptions.',
        })
    used = count_applications_for_slot(
        campaign, track, ecofo_year, post_section, post_year,
    )
    if used >= row['seats']:
        raise ValidationError({
            'track': 'Plus de places disponibles pour cette année.',
        })
    return row['seats'] - used
