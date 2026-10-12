"""Verrouillage de connexion. Seuils lus dans les paramètres Super Admin."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import Throttled

from .email_identity import normalize_login_email
from .models import AuthLock

DEFAULT_MAX_FAILURES = 5
DEFAULT_LOCK_MINUTES = 15


def login_lock_policy() -> tuple[int, int]:
    try:
        from site_content.models import SiteSettings

        obj = SiteSettings.objects.first()
        if obj is not None:
            failures = max(1, min(int(obj.login_max_failures or DEFAULT_MAX_FAILURES), 20))
            minutes = max(1, min(int(obj.login_lock_minutes or DEFAULT_LOCK_MINUTES), 24 * 60))
            return failures, minutes
    except Exception:
        pass
    return DEFAULT_MAX_FAILURES, DEFAULT_LOCK_MINUTES


def _row(email: str) -> AuthLock | None:
    key = normalize_login_email(email)
    if not key:
        return None
    row, _created = AuthLock.objects.get_or_create(email=key)
    return row


def assert_not_locked(email: str) -> None:
    row = _row(email)
    if not row or not row.locked_until:
        return
    if row.locked_until > timezone.now():
        seconds = (row.locked_until - timezone.now()).total_seconds()
        minutes = max(1, int((seconds + 59) // 60))
        raise Throttled(detail=f'Trop d’essais. Réessayez dans {minutes} minute(s).')
    row.failures = 0
    row.locked_until = None
    row.save(update_fields=['failures', 'locked_until', 'updated_at'])


def record_failure(email: str) -> None:
    row = _row(email)
    if not row:
        return
    max_failures, lock_minutes = login_lock_policy()
    row.failures = (row.failures or 0) + 1
    if row.failures >= max_failures:
        row.locked_until = timezone.now() + timedelta(minutes=lock_minutes)
    row.save(update_fields=['failures', 'locked_until', 'updated_at'])


def record_success(email: str) -> None:
    key = normalize_login_email(email)
    if not key:
        return
    AuthLock.objects.filter(email=key).update(failures=0, locked_until=None)
