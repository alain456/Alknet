"""Lecture d'un lien Google Maps : coordonnées dans l'URL, ou après redirection."""

import re
from urllib.parse import unquote, urljoin, urlparse

import urllib.error
import urllib.request

_PIN = re.compile(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)')
_AT = re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)')
_QUERY = re.compile(
    r'[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:[,+\s]|%2C)+(-?\d+\.\d+)',
    re.IGNORECASE,
)
_PAIR = re.compile(r'(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)')
_ALLOWED_HOSTS = {
    'google.com',
    'www.google.com',
    'maps.google.com',
    'maps.app.goo.gl',
    'goo.gl',
}


def extract_coordinates(text):
    """Retourne (latitude, longitude) ou None. Le repère !3d!4d prime sur la caméra @."""
    raw = unquote(str(text or ''))
    pin = _PIN.search(raw)
    if pin and _valid(pin.group(1), pin.group(2)):
        return pin.group(1), pin.group(2)
    at = _AT.search(raw)
    if at and _valid(at.group(1), at.group(2)):
        return at.group(1), at.group(2)
    query = _QUERY.search(raw)
    if query and _valid(query.group(1), query.group(2)):
        return query.group(1), query.group(2)
    if not raw.strip().lower().startswith('http'):
        pair = _PAIR.search(raw)
        if pair and _valid(pair.group(1), pair.group(2)):
            return pair.group(1), pair.group(2)
    return None


def _valid(lat, lng):
    try:
        lat_n, lng_n = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return -90 <= lat_n <= 90 and -180 <= lng_n <= 180


def _allowed(url):
    parsed = urlparse(url)
    host = (parsed.hostname or '').lower()
    return parsed.scheme == 'https' and host in _ALLOWED_HOSTS and not parsed.username


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def resolve_maps_link(text):
    """Coordonnées déjà dans le texte, ou lues après les redirections d'un lien court."""
    found = extract_coordinates(text)
    if found:
        return found
    url = str(text or '').strip()
    if not _allowed(url):
        raise ValueError('Lien Google Maps attendu.')
    opener = urllib.request.build_opener(_NoRedirect)
    for _ in range(5):
        request = urllib.request.Request(url, headers={'User-Agent': 'IsokoHub/1.0'})
        try:
            with opener.open(request, timeout=6) as response:
                url = response.geturl()
        except urllib.error.HTTPError as exc:
            location = exc.headers.get('Location') if exc.headers else None
            if exc.code not in (301, 302, 303, 307, 308) or not location:
                raise
            url = urljoin(str(exc.geturl() or request.full_url), location)
        found = extract_coordinates(url)
        if found:
            return found
        if not _allowed(url):
            raise ValueError('Redirection hors Google Maps.')
    return None
