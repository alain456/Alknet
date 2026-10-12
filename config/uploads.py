"""Validation d'upload : extension ET type MIME ET octets magiques. SVG/HTML refusés."""
from __future__ import annotations

import os

from django.core.exceptions import ValidationError

MAX_UPLOAD_BYTES = 8 * 1024 * 1024

_BLOCKED_EXTENSIONS = frozenset({
    '.svg', '.svgz', '.html', '.htm', '.xhtml', '.xml', '.js', '.mjs',
    '.php', '.phtml', '.shtml', '.exe', '.dll',
})

_ALLOWED = {
    '.jpg': {'image/jpeg', 'image/jpg', 'image/pjpeg'},
    '.jpeg': {'image/jpeg', 'image/jpg', 'image/pjpeg'},
    '.png': {'image/png'},
    '.gif': {'image/gif'},
    '.webp': {'image/webp'},
    '.pdf': {'application/pdf'},
}
# Certains navigateurs envoient ce type même pour un JPG, PNG ou PDF valide.
_GENERIC_TYPES = frozenset({'', 'application/octet-stream', 'binary/octet-stream', 'application/binary'})

_MAGIC = {
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.png': (b'\x89PNG\r\n\x1a\n',),
    '.gif': (b'GIF87a', b'GIF89a'),
    '.pdf': (b'%PDF-',),
}

_MARKUP = (b'<svg', b'<html', b'<!doctype', b'<script', b'<?xml')


def _head(uploaded, size: int = 64) -> bytes:
    uploaded.seek(0)
    data = uploaded.read(size) or b''
    uploaded.seek(0)
    return data


def _is_webp(head: bytes) -> bool:
    return len(head) >= 12 and head[:4] == b'RIFF' and head[8:12] == b'WEBP'


def _ext_from_magic(head: bytes) -> str:
    if head.startswith(b'\xff\xd8\xff'):
        return '.jpg'
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if head.startswith((b'GIF87a', b'GIF89a')):
        return '.gif'
    if head.startswith(b'%PDF-'):
        return '.pdf'
    if _is_webp(head):
        return '.webp'
    return ''


def _is_heic(head: bytes) -> bool:
    return len(head) >= 12 and head[4:8] == b'ftyp' and head[8:12] in {
        b'heic', b'heix', b'hevc', b'hevx', b'mif1', b'msf1',
    }


def validate_binary_upload(uploaded, *, max_bytes: int = MAX_UPLOAD_BYTES) -> str:
    """Lève ValidationError si le fichier n'est pas jpg, png, gif, webp ou pdf cohérent.

    Le format est reconnu sur le contenu. Une photo envoyée sans extension,
    ou avec un type générique, reste acceptée si les octets sont ceux d'un JPG ou d'un PDF.
    """
    if not uploaded:
        raise ValidationError('Fichier manquant.')
    size = getattr(uploaded, 'size', None) or 0
    if size <= 0:
        raise ValidationError('Fichier vide.')
    if size > max_bytes:
        raise ValidationError('Fichier trop volumineux (max. 8 Mo).')

    head = _head(uploaded)
    lowered = head.lstrip().lower()
    if lowered.startswith(b'<') or any(mark in lowered[:256] for mark in _MARKUP):
        raise ValidationError('Les fichiers HTML et SVG sont refusés.')
    if _is_heic(head):
        raise ValidationError('Photo iPhone au format HEIC. Enregistrez-la en JPG ou en PDF.')

    named = os.path.splitext(getattr(uploaded, 'name', '') or '')[1].lower()
    if named in _BLOCKED_EXTENSIONS:
        raise ValidationError('Formats acceptés : JPG, PNG, WebP, GIF ou PDF.')

    detected = _ext_from_magic(head)
    ext = detected or (named if named in _ALLOWED else '')
    if not ext:
        raise ValidationError('Formats acceptés : JPG, PNG, WebP, GIF ou PDF.')

    content_type = (getattr(uploaded, 'content_type', None) or '').split(';')[0].strip().lower()
    typed_ok = content_type in _ALLOWED[ext] or content_type in _GENERIC_TYPES or bool(detected)
    if not typed_ok:
        raise ValidationError('Le type du fichier ne correspond pas à son extension.')
    return ext
