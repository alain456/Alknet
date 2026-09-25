"""Détection des messages client vs réponses hôtel dans special_requests."""
from __future__ import annotations

import re

from django.utils import timezone

# Client : [2026-03-18 10:00 — Alice] …
# Hôtel  : [2026-03-18 10:05 — Nom Hôtel · Agent] …
_STAMPED = re.compile(
    r'^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) — ([^\]]+)\]\s*(.*)$',
    re.MULTILINE,
)


def iter_thread_entries(special_requests: str):
    for match in _STAMPED.finditer(special_requests or ''):
        stamp, who, body = match.groups()
        yield {
            'stamp': stamp,
            'who': who.strip(),
            'body': (body or '').strip(),
            'is_hotel': ' · ' in who,
        }


def has_client_message(special_requests: str) -> bool:
    """True s’il existe au moins un message horodaté du client."""
    return any(not e['is_hotel'] for e in iter_thread_entries(special_requests))


def client_message_pending(special_requests: str) -> bool:
    """True si le dernier message horodaté est du client (réponse hôtel attendue)."""
    last = None
    for entry in iter_thread_entries(special_requests):
        last = entry
    return bool(last) and not last['is_hotel']


def last_client_message(special_requests: str) -> str:
    last = ''
    for entry in iter_thread_entries(special_requests):
        if not entry['is_hotel']:
            last = entry['body']
    return last


def append_hotel_history_line(reservation, message: str, *, author: str = 'Hôtel') -> str:
    """
    Ajoute une ligne horodatée côté hôtel dans special_requests
    (visible dans l’historique client).
    """
    text = (message or '').strip()
    if not text:
        return reservation.special_requests or ''
    stamp = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M')
    hotel_label = (getattr(reservation.hotel, 'name', None) or 'Hôtel').strip()
    who = f'{hotel_label} · {(author or "Hôtel").strip()}'
    line = f'[{stamp} — {who}] {text[:2000]}'
    prev = (reservation.special_requests or '').strip()
    reservation.special_requests = f'{prev}\n{line}'.strip() if prev else line
    return reservation.special_requests
