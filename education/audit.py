"""Journal des écritures éducation, rattaché à l'établissement."""
import logging

logger = logging.getLogger(__name__)


def audit_education(action, business, resource, *, user=None, request=None, **details):
    from accounts.services import log_audit_event

    actor = user if getattr(user, 'is_authenticated', False) else None
    payload = {'business_id': str(getattr(business, 'id', '') or '')}
    payload.update(details)
    try:
        log_audit_event(
            user=actor,
            action=action,
            resource=resource,
            request=request,
            event_category='DATA_CHANGE',
            details=payload,
        )
    except Exception:
        logger.exception('Journal éducation indisponible pour %s', action)
