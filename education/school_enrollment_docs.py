"""Pièces d'inscription scolaire par parcours.

Catalogue plateforme : l'admin d'école n'a pas à retaper ces libellés.
Il peut seulement ajouter des pièces locales (optionnelles) sur la campagne.
"""

from .school_years import year_label

TRACK_PRESCOLAIRE = 'PRESCOLAIRE'
TRACK_ECOFO = 'ECOFO'
TRACK_POST = 'POST_FONDAMENTAL'

TRACK_CHOICES = (
    (TRACK_PRESCOLAIRE, 'Maternelle / Préscolaire'),
    (TRACK_ECOFO, 'École fondamentale (ECOFO)'),
    (TRACK_POST, 'Post-fondamental'),
)

DOC_BIRTH = "Extrait d'acte de naissance"
DOC_BULLETIN = 'Bulletin'
DOC_ATTENDANCE = 'Attestation de fréquentation'
DOC_CLEARANCE = 'Attestation de non-redevabilité'


def _item(label, description=''):
    return {'label': label, 'description': description or '', 'required': True}


def _is_first_year(year):
    raw = str(year or '').strip().lower().replace('è', 'e').replace('é', 'e')
    return raw in ('1', '01', 'first', '1ere', '1ere annee')


def documents_for_track(track, ecofo_year='', post_year=''):
    """Liste figée des pièces selon le parcours (et l'année)."""
    track = (track or '').strip()
    if track == TRACK_PRESCOLAIRE:
        return [_item(DOC_BIRTH)]
    if track == TRACK_ECOFO:
        if _is_first_year(ecofo_year):
            return [_item(DOC_BIRTH)]
        return [_item(DOC_BULLETIN), _item(DOC_ATTENDANCE), _item(DOC_CLEARANCE)]
    if track == TRACK_POST:
        if _is_first_year(post_year):
            return [_item(DOC_BIRTH)]
        return [_item(DOC_BULLETIN), _item(DOC_ATTENDANCE), _item(DOC_CLEARANCE)]
    return []


def merge_optional_documents(required, extras):
    """Ajoute les pièces locales de l'école sans dupliquer un libellé catalogue."""
    seen = {(row.get('label') or '').strip().lower() for row in required if isinstance(row, dict)}
    merged = [dict(row) for row in required]
    for row in extras or []:
        if not isinstance(row, dict):
            continue
        label = (row.get('label') or '').strip()
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        merged.append({
            'label': label,
            'description': (row.get('description') or '').strip(),
            'required': bool(row.get('required', True)),
        })
    return merged


def offered_tracks(profile):
    """Parcours réellement proposés par l'école."""
    if not profile:
        return []
    tracks = []
    if getattr(profile, 'offers_prescolaire', False):
        tracks.append(TRACK_PRESCOLAIRE)
    if getattr(profile, 'offers_ecofo', False):
        tracks.append(TRACK_ECOFO)
    if getattr(profile, 'offers_post_fondamental', False):
        tracks.append(TRACK_POST)
    return tracks


def track_label(track):
    return dict(TRACK_CHOICES).get(track, track or '')


CRITERIA_KINDS = {
    'TEST': 'Test de sélection',
    'INTERVIEW': 'Entretien',
    'OTHER': 'Autre critère',
}


def normalize_extra_criteria(raw):
    """Critères ajoutés par l'école (test, entretien, autre)."""
    out = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        kind = str(item.get('kind') or 'OTHER').strip().upper()
        if kind not in CRITERIA_KINDS:
            kind = 'OTHER'
        label = (item.get('label') or '').strip() or CRITERIA_KINDS[kind]
        details = (item.get('details') or '').strip()
        place = (item.get('place') or '').strip()
        date = str(item.get('date') or '').strip()
        if date in ('', 'null', 'None'):
            date = ''
        out.append({
            'kind': kind,
            'label': label[:200],
            'date': date[:20],
            'place': place[:200],
            'details': details[:500],
        })
    return out


def catalog_preview():
    """Aperçu générique pour l'API enums (sans profil école)."""
    return {
        TRACK_PRESCOLAIRE: {
            'label': track_label(TRACK_PRESCOLAIRE),
            'documents': documents_for_track(TRACK_PRESCOLAIRE),
        },
        TRACK_ECOFO: {
            'label': track_label(TRACK_ECOFO),
            'note': 'Les années proposées dépendent des cycles cochés par l’école.',
            'sample_years': [
                {'value': '1', 'label': year_label(1), 'documents': documents_for_track(TRACK_ECOFO, '1')},
                {'value': '2', 'label': year_label(2), 'documents': documents_for_track(TRACK_ECOFO, '2')},
            ],
        },
        TRACK_POST: {
            'label': track_label(TRACK_POST),
            'documents': documents_for_track(TRACK_POST),
            'note': 'Les années proposées sont définies par section sur la fiche de l’école.',
        },
    }


def application_document_labels(application):
    docs = application.required_documents
    if not docs:
        docs = application.campaign.required_documents or []
    return [
        item.get('label', '').strip()
        for item in docs
        if isinstance(item, dict) and item.get('label', '').strip()
    ]
