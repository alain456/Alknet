"""Sert /media/ uniquement à un utilisateur authentifié. Ordonnances et labo : accès nominatif."""
from __future__ import annotations

from django.conf import settings
from django.http import Http404, HttpResponse
from django.views.static import serve

from accounts.authentication import user_from_request

_PRIVATE_PREFIXES = (
    'retail/prescriptions/',
    'hospital/lab/',
)


def _safe_path(path: str) -> str:
    cleaned = (path or '').replace('\\', '/').lstrip('/')
    if not cleaned or cleaned.startswith('/') or '..' in cleaned.split('/'):
        raise Http404
    return cleaned


def _staff_of(user, business) -> bool:
    if not business or not user or not getattr(user, 'is_authenticated', False):
        return False
    if business.owner_id == user.id:
        return True
    return business.employees.filter(user=user, is_active=True).exists()


def _can_read(user, relative: str) -> bool:
    if getattr(user, 'role', '') == 'SUPER_ADMIN' or getattr(user, 'is_superuser', False):
        return True
    if relative.startswith('retail/prescriptions/'):
        from retail.models import Prescription
        row = Prescription.objects.select_related('retail_business', 'patient').filter(file=relative).first()
        if not row:
            return False
        if row.patient_id == user.id:
            return True
        return _staff_of(user, row.retail_business)
    if relative.startswith('hospital/lab/'):
        from hospital.models import LabResult
        row = LabResult.objects.select_related('hospital', 'patient').filter(document=relative).first()
        if not row:
            return False
        if row.patient_id == user.id:
            return True
        if row.uploaded_by_id == user.id:
            return True
        return _staff_of(user, row.hospital)
    return True


def protected_media(request, path):
    relative = _safe_path(path)
    full = settings.MEDIA_ROOT / relative
    if not full.is_file():
        raise Http404
    # Logos et avatars : visibles sur les fiches publiques.
    if relative.startswith('public/profiles/'):
        response = serve(request, relative, document_root=settings.MEDIA_ROOT)
        response['Cache-Control'] = 'no-cache'
        return response
    user = user_from_request(request)
    if not user or not getattr(user, 'is_authenticated', False):
        return HttpResponse(status=401)
    if relative.startswith(_PRIVATE_PREFIXES) and not _can_read(user, relative):
        return HttpResponse(status=403)
    return serve(request, relative, document_root=settings.MEDIA_ROOT)
