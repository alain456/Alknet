from django.contrib.auth import get_user_model

User = get_user_model()

def create_user(*, email: str, password: str, role: str = 'CUSTOMER', **extra_fields) -> User:
    """
    Service pour créer un utilisateur standard.
    """
    user = User.objects.create_user(
        email=email,
        password=password,
        role=role,
        **extra_fields
    )
    return user


def get_client_ip(request):
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_audit_event(
    *,
    user=None,
    user_email='',
    user_role='',
    action='',
    resource='',
    request=None,
    status='SUCCESS',
    details=None,
    old_value=None,
    new_value=None,
    error_code=None,
    error_message=None,
    impersonated_by=None,
    on_behalf_of=None,
    event_category=None,
    geo_location=None,
):
    from .models import AuditLog
    ip_address = get_client_ip(request) if request else None
    user_agent = request.META.get('HTTP_USER_AGENT', '') if request else ''

    email = user_email
    role = user_role
    if user:
        if not email:
            email = getattr(user, 'email', '')
        if not role:
            role = getattr(user, 'role', 'USER')

    if not email:
        email = 'ANONYMOUS'

    payload = dict(details or {})
    if old_value is not None and 'old_value' not in payload:
        payload['old_value'] = old_value
    if new_value is not None and 'new_value' not in payload:
        payload['new_value'] = new_value
    if error_code and 'error_code' not in payload:
        payload['error_code'] = error_code
    if error_message and 'error_message' not in payload:
        payload['error_message'] = error_message
    if impersonated_by:
        payload['impersonation'] = True
        payload['impersonated_by'] = impersonated_by
    if on_behalf_of:
        payload['on_behalf_of'] = on_behalf_of
    if event_category:
        payload['event_category'] = event_category
    if geo_location:
        payload['geo_location'] = geo_location
    if user is not None and getattr(user, 'pk', None) and 'user_id' not in payload:
        payload['user_id'] = str(user.pk)

    return AuditLog.objects.create(
        user=user if hasattr(user, 'pk') and user.pk else None,
        user_email=email,
        user_role=role or 'ANONYMOUS',
        action=action,
        resource=resource,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        details=payload,
    )

