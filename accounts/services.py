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


def log_audit_event(*, user=None, user_email='', user_role='', action='', resource='', request=None, status='SUCCESS', details=None):
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
        
    return AuditLog.objects.create(
        user=user if hasattr(user, 'pk') and user.pk else None,
        user_email=email,
        user_role=role or 'ANONYMOUS',
        action=action,
        resource=resource,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        details=details or {}
    )

