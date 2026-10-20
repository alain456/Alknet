"""Photos de profil et logos : fichier JPEG public, une seule règle de taille."""
from __future__ import annotations

import base64
import binascii
from io import BytesIO

from django.conf import settings
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

MAX_BYTES = 8 * 1024 * 1024
MIME_OK = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp'}
FORMAT_OK = {'JPEG', 'PNG', 'WEBP', 'MPO'}


def _fail(message):
    raise ValidationError(message)


def store_profile_image(raw, *, kind, key):
    """
    Enregistre un JPEG sous /media/public/profiles/.
    kind = avatar (carré 512) ou logo (800 px, proportions gardées).
    Une URL http(s) ou /media/ déjà publique est conservée telle quelle.
    Chaîne vide = effacer.
    """
    value = (raw or '').strip()
    if not value:
        return ''
    if value.startswith(('http://', 'https://', '/media/')):
        return value
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
    if len(blob) > MAX_BYTES:
        _fail('Image trop lourde (maximum 8 Mo).')
    try:
        img = Image.open(BytesIO(blob))
        img.load()
    except (UnidentifiedImageError, OSError):
        _fail('Image illisible.')
    if (img.format or '').upper() not in FORMAT_OK:
        _fail('Formats acceptés : JPEG, PNG, WebP.')

    img = img.convert('RGB')
    if kind == 'avatar':
        side = min(img.width, img.height)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        img = img.crop((left, top, left + side, top + side))
        img.thumbnail((512, 512))
        folder = 'avatars'
    else:
        img.thumbnail((800, 800))
        folder = 'logos'

    out = BytesIO()
    img.save(out, format='JPEG', quality=82, optimize=True)
    relative = f'public/profiles/{folder}/{key}.jpg'
    dest = settings.MEDIA_ROOT / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(out.getvalue())
    return f'/media/{relative}'


def versioned_media_url(value):
    """Ajoute la date du fichier. La même adresse ne garde plus l’ancienne image."""
    raw = (value or '').strip()
    if not raw.startswith('/media/'):
        return raw
    path = raw.split('?', 1)[0]
    relative = path[len('/media/'):].lstrip('/')
    full = settings.MEDIA_ROOT / relative
    try:
        stamp = int(full.stat().st_mtime)
    except OSError:
        return path
    return f'{path}?v={stamp}'


def publish_model_image(instance, field, *, kind, key):
    """Remplace un data:image stocké par l'adresse du fichier. Les URL restent."""
    value = (getattr(instance, field, None) or '').strip()
    if not value:
        return ''
    if value.startswith(('http://', 'https://')):
        return value
    if value.startswith('/media/'):
        return versioned_media_url(value)
    if not value.startswith('data:image/'):
        return ''
    try:
        stored = store_profile_image(value, kind=kind, key=key)
    except ValidationError:
        return ''
    if stored and stored != value:
        setattr(instance, field, stored.split('?', 1)[0])
        instance.save(update_fields=[field])
    current = (getattr(instance, field, None) or stored or '').strip()
    return versioned_media_url(current)


def display_business_logo(business):
    if business is None:
        return ''
    return publish_model_image(business, 'logo', kind='logo', key=str(business.pk))


def assign_person_photo(user, raw):
    """Une seule photo : profil et fiche médecin reçoivent la même adresse."""
    from profiles.models import Profile

    stored = store_profile_image(raw, kind='avatar', key=str(user.pk))
    profile, _ = Profile.objects.get_or_create(user=user)
    if profile.avatar != stored:
        profile.avatar = stored
        profile.save(update_fields=['avatar'])
    try:
        doctor = user.doctor_profile
    except Exception:
        doctor = None
    if doctor is not None and (doctor.photo_url or '') != stored:
        doctor.photo_url = stored
        doctor.save(update_fields=['photo_url'])
    return stored


def display_person_photo(user):
    """Adresse courte. Convertit une ancienne image encodée au premier affichage."""
    try:
        profile = user.profile
    except Exception:
        profile = None
    try:
        doctor = user.doctor_profile
    except Exception:
        doctor = None
    raw = ''
    if doctor and (doctor.photo_url or '').strip():
        raw = doctor.photo_url.strip()
    elif profile and (profile.avatar or '').strip():
        raw = profile.avatar.strip()
    if not raw:
        return ''
    if raw.startswith(('http://', 'https://')):
        return raw
    if raw.startswith('/media/'):
        return versioned_media_url(raw)
    if not raw.startswith('data:image/'):
        return ''
    try:
        return assign_person_photo(user, raw)
    except ValidationError:
        return ''
