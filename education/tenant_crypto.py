"""Chiffrement par établissement des champs personnels d'un dossier.

La clé de l'établissement est tirée au hasard et stockée enveloppée par la clé
plateforme (`TENANT_MASTER_KEY`, sinon `SECRET_KEY`). Deux établissements ne
partagent pas la même clé. L'e-mail du candidat reste en clair : il sert aux
recherches et à l'unicité du dossier.
"""
import base64
import hashlib
import json
import os

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

PREFIX = 'enc1:'
APPLICATION_TEXT = (
    'student_phone',
    'guardian_phone',
    'student_address',
    'guardian_name',
    'previous_school',
    'decision_note',
)


def _master():
    raw = (os.environ.get('TENANT_MASTER_KEY') or '').strip() or settings.SECRET_KEY
    digest = hashlib.sha256(raw.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def tenant_fernet(business_id):
    from businesses.models import Business

    business = Business.objects.filter(pk=business_id).first()
    if business is None:
        return None
    extra = dict(business.extra_attributes or {})
    wrapped = extra.get('tenant_data_key') or ''
    if not wrapped:
        raw_key = Fernet.generate_key()
        extra['tenant_data_key'] = _master().encrypt(raw_key).decode()
        business.extra_attributes = extra
        business.save(update_fields=['extra_attributes'])
        wrapped = extra['tenant_data_key']
    try:
        raw_key = _master().decrypt(wrapped.encode())
    except InvalidToken:
        return None
    return Fernet(raw_key)


def encrypt_text(business_id, value):
    if value is None or value == '':
        return value or ''
    text = str(value)
    if text.startswith(PREFIX):
        return text
    box = tenant_fernet(business_id)
    if box is None:
        return text
    return PREFIX + box.encrypt(text.encode()).decode()


def decrypt_text(business_id, value):
    text = '' if value is None else str(value)
    if not text.startswith(PREFIX):
        return text
    box = tenant_fernet(business_id)
    if box is None:
        return text
    try:
        return box.decrypt(text[len(PREFIX):].encode()).decode()
    except InvalidToken:
        return text


def encrypt_json(business_id, value):
    if isinstance(value, dict) and set(value.keys()) == {'_enc'}:
        return value
    if not value:
        return value if value is not None else {}
    box = tenant_fernet(business_id)
    if box is None:
        return value
    raw = json.dumps(value, ensure_ascii=False, default=str).encode()
    return {'_enc': PREFIX + box.encrypt(raw).decode()}


def decrypt_json(business_id, value):
    if not isinstance(value, dict) or '_enc' not in value:
        return value if value is not None else {}
    token = str(value.get('_enc') or '')
    if not token.startswith(PREFIX):
        return value
    box = tenant_fernet(business_id)
    if box is None:
        return value
    try:
        raw = box.decrypt(token[len(PREFIX):].encode()).decode()
    except InvalidToken:
        return value
    loaded = json.loads(raw)
    return loaded if isinstance(loaded, dict) else {}


def close_application(instance, update_fields=None):
    if not instance.business_id:
        return
    names = APPLICATION_TEXT
    if update_fields is not None:
        names = tuple(name for name in APPLICATION_TEXT if name in update_fields)
    business_id = instance.business_id
    for name in names:
        setattr(instance, name, encrypt_text(business_id, getattr(instance, name)))
    if update_fields is None or 'profile_details' in update_fields:
        instance.profile_details = encrypt_json(business_id, instance.profile_details)


def open_application(instance):
    if not instance.business_id:
        return
    business_id = instance.business_id
    for name in APPLICATION_TEXT:
        setattr(instance, name, decrypt_text(business_id, getattr(instance, name)))
    instance.profile_details = decrypt_json(business_id, instance.profile_details)


def close_payment(instance, update_fields=None):
    if update_fields is not None and 'payer_phone' not in update_fields:
        return
    business_id = getattr(getattr(instance, 'fee', None), 'business_id', None)
    if not business_id and instance.fee_id:
        from .models import EducationFee
        business_id = EducationFee.objects.filter(pk=instance.fee_id).values_list('business_id', flat=True).first()
    if not business_id:
        return
    instance.payer_phone = encrypt_text(business_id, instance.payer_phone)


def open_payment(instance):
    business_id = getattr(getattr(instance, 'fee', None), 'business_id', None)
    if not business_id and instance.fee_id:
        from .models import EducationFee
        business_id = EducationFee.objects.filter(pk=instance.fee_id).values_list('business_id', flat=True).first()
    if not business_id:
        return
    instance.payer_phone = decrypt_text(business_id, instance.payer_phone)
