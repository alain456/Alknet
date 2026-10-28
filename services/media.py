"""Images et vidéos du module Services : fichiers publics sous /media/public/services/."""
from __future__ import annotations

import base64
import binascii
import re
from io import BytesIO

from django.conf import settings
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

from profiles.images import versioned_media_url

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = 1_800_000
MIME_OK = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp'}
FORMAT_OK = {'JPEG', 'PNG', 'WEBP', 'MPO'}
VIDEO_MIME = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
}
PUBLIC_PREFIX = '/media/public/services/'


def _fail(message):
    raise ValidationError(message)


def _safe_key(key):
    parts = [part for part in str(key or '').split('/') if part and part not in {'.', '..'}]
    cleaned = [re.sub(r'[^A-Za-z0-9._-]', '', part) for part in parts]
    return '/'.join(part for part in cleaned if part) or 'file'


def stored_path(value):
    text = (value or '').strip().split('?', 1)[0]
    return text


def public_url(value):
    return versioned_media_url(stored_path(value))


def store_service_image(raw, *, key, square=False, max_side=1200):
    value = (raw or '').strip()
    if not value:
        return ''
    if value.startswith(('http://', 'https://', '/media/')):
        return stored_path(value)
    if not value.startswith('data:image/'):
        _fail('Image invalide (JPEG, PNG ou WebP).')

    header, _, b64 = value.partition(',')
    mime = header[5:].split(';', 1)[0].lower()
    if mime not in MIME_OK:
        _fail('Formats acceptés : JPEG, PNG, WebP.')
    try:
        blob = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        _fail('Image illisible.')
    if len(blob) > MAX_IMAGE_BYTES:
        _fail('Image trop lourde (maximum 8 Mo).')
    try:
        img = Image.open(BytesIO(blob))
        img.load()
    except (UnidentifiedImageError, OSError):
        _fail('Image illisible.')
    if (img.format or '').upper() not in FORMAT_OK:
        _fail('Formats acceptés : JPEG, PNG, WebP.')

    img = img.convert('RGB')
    if square:
        side = min(img.width, img.height)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        img = img.crop((left, top, left + side, top + side))
        img.thumbnail((min(max_side, 512), min(max_side, 512)))
    else:
        img.thumbnail((max_side, max_side))

    out = BytesIO()
    img.save(out, format='JPEG', quality=82, optimize=True)
    relative = f'public/services/{_safe_key(key)}.jpg'
    dest = settings.MEDIA_ROOT / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(out.getvalue())
    return f'/media/{relative}'


def store_service_video(raw, *, key):
    value = (raw or '').strip()
    if not value:
        return ''
    if value.startswith(('http://', 'https://', '/media/')):
        return stored_path(value)
    if not value.startswith('data:video/'):
        _fail('Vidéo invalide (MP4 ou WebM).')

    header, _, b64 = value.partition(',')
    mime = header[5:].split(';', 1)[0].lower()
    ext = VIDEO_MIME.get(mime)
    if not ext:
        _fail('Formats vidéo acceptés : MP4 ou WebM.')
    try:
        blob = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        _fail('Vidéo illisible.')
    if len(blob) > MAX_VIDEO_BYTES:
        _fail('Vidéo trop lourde. Utilisez un lien YouTube ou un fichier plus court.')

    relative = f'public/services/{_safe_key(key)}.{ext}'
    dest = settings.MEDIA_ROOT / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(blob)
    return f'/media/{relative}'


def persist_image_field(instance, field, *, key, square=False, max_side=1200):
    raw = stored_path(getattr(instance, field, '') or '')
    if not raw or not raw.startswith('data:image/'):
        return raw
    stored = store_service_image(raw, key=key, square=square, max_side=max_side)
    if stored != raw:
        setattr(instance, field, stored)
        instance.save(update_fields=[field])
    return stored


def persist_video_field(instance, field, *, key):
    raw = stored_path(getattr(instance, field, '') or '')
    if not raw or not raw.startswith('data:video/'):
        return raw
    stored = store_service_video(raw, key=key)
    if stored != raw:
        setattr(instance, field, stored)
        instance.save(update_fields=[field])
    return stored


def persist_team_photo(member):
    if not member or not member.pk:
        return ''
    persist_image_field(member, 'photo_url', key=f'portraits/{member.pk}', square=True, max_side=512)
    return public_url(member.photo_url)


def persist_offer_images(offer):
    if not offer or not offer.pk:
        return []
    urls = list(offer.image_urls or [])
    stored = []
    changed = False
    for index, raw in enumerate(urls):
        value = stored_path(raw)
        if value.startswith('data:image/'):
            value = store_service_image(value, key=f'offers/{offer.pk}-{index}', max_side=1200)
            changed = True
        stored.append(value)
    if changed:
        offer.image_urls = stored
        offer.save(update_fields=['image_urls', 'updated_at'])
    return [public_url(item) for item in (offer.image_urls or [])]


def persist_document_file(document):
    if not document or not document.pk:
        return ''
    key = f'docs/{document.pk}'
    kind = (document.kind or '').upper()
    raw = stored_path(document.file_url)
    if kind == 'TESTIMONY':
        persist_video_field(document, 'file_url', key=f'videos/{document.pk}')
    elif raw.startswith('data:image/'):
        persist_image_field(document, 'file_url', key=key, square=False, max_side=1600)
    elif raw.startswith('data:video/'):
        persist_video_field(document, 'file_url', key=f'videos/{document.pk}')
    return public_url(document.file_url)
