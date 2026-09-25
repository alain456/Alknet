"""Stockage fichier ordonnance retail (upload réel → MEDIA)."""
from __future__ import annotations

import os
import re
import uuid

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile

ALLOWED_PRESCRIPTION_CONTENT_TYPES = frozenset({
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
})
ALLOWED_PRESCRIPTION_EXTENSIONS = frozenset({
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf',
})
MAX_PRESCRIPTION_BYTES = 8 * 1024 * 1024


def _safe_filename(name: str) -> str:
    base = os.path.basename(name or 'ordonnance')
    base = re.sub(r'[^\w.\-]+', '_', base, flags=re.UNICODE).strip('._') or 'ordonnance'
    return base[:120]


def validate_prescription_upload(uploaded: UploadedFile) -> None:
    if not uploaded:
        raise ValidationError('Fichier ordonnance manquant.')
    size = getattr(uploaded, 'size', None) or 0
    if size <= 0:
        raise ValidationError('Fichier ordonnance vide.')
    if size > MAX_PRESCRIPTION_BYTES:
        raise ValidationError('Ordonnance trop volumineuse (max. 8 Mo).')
    content_type = (getattr(uploaded, 'content_type', None) or '').split(';')[0].strip().lower()
    ext = os.path.splitext(getattr(uploaded, 'name', '') or '')[1].lower()
    type_ok = content_type in ALLOWED_PRESCRIPTION_CONTENT_TYPES or content_type.startswith('image/')
    ext_ok = ext in ALLOWED_PRESCRIPTION_EXTENSIONS
    if not type_ok and not ext_ok:
        raise ValidationError('Formats acceptés : JPG, PNG, WebP, GIF ou PDF.')


def prescription_upload_to(instance, filename: str) -> str:
    safe = _safe_filename(filename)
    return f'retail/prescriptions/{uuid.uuid4().hex[:12]}_{safe}'


def extract_prescription_upload(request_data) -> UploadedFile | None:
    """Lit prescription_file / file depuis request.data (multipart) ou request.FILES."""
    for key in ('prescription_file', 'file', 'ordonnance'):
        uploaded = request_data.get(key) if hasattr(request_data, 'get') else None
        if isinstance(uploaded, UploadedFile):
            return uploaded
    return None


def attach_prescription_file(prescription, uploaded: UploadedFile) -> None:
    """Enregistre le FileField et synchronise file_url vers l’URL média."""
    validate_prescription_upload(uploaded)
    prescription.file.save(_safe_filename(uploaded.name), uploaded, save=False)
    # URL relative servie via /media/ (proxy Vite en dev)
    prescription.file_url = prescription.file.url
