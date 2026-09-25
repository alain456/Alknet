"""
Bloque les écritures API métier si l'abonnement SaaS de l'entreprise est inactif.
Les lectures et les endpoints d'abonnement / auth restent ouverts.
"""
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin


_ALWAYS_ALLOW_PREFIXES = (
    '/api/v1/accounts/',
    '/api/v1/token/',
    '/api/v1/auth/',
    '/admin/',
    '/api/v1/businesses/me/subscription',
    '/api/v1/businesses/payments/burundipay/',
    '/api/v1/businesses/payments/lumicash/',
    '/api/v1/businesses/admin/',
    '/api/schema',
    '/api/docs',
)

_WRITE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}


class ActiveSubscriptionMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if request.method not in _WRITE_METHODS:
            return None
        path = request.path or ''
        if not path.startswith('/api/'):
            return None
        for prefix in _ALWAYS_ALLOW_PREFIXES:
            if path.startswith(prefix):
                return None
        if '/businesses/register' in path:
            return None
        # Création d'entreprise (essai auto)
        if request.method == 'POST' and (
            path.rstrip('/').endswith('/api/v1/businesses')
            or path.rstrip('/').endswith('/api/v1/businesses/me')
        ):
            return None

        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            # JWT est authentifié au niveau DRF, pas la session Django
            try:
                from rest_framework_simplejwt.authentication import JWTAuthentication
                from rest_framework.exceptions import AuthenticationFailed

                auth_result = JWTAuthentication().authenticate(request)
                if auth_result:
                    user = auth_result[0]
                    request.user = user
            except AuthenticationFailed:
                return None
            except Exception:
                return None

        if not user or not getattr(user, 'is_authenticated', False):
            return None
        if getattr(user, 'role', None) == 'SUPER_ADMIN':
            return None
        if getattr(user, 'is_superuser', False):
            return None

        from .tenant import get_user_tenant_business
        from .subscription import business_has_active_subscription

        business = get_user_tenant_business(user)
        if not business:
            return None
        if business_has_active_subscription(business):
            return None

        return JsonResponse(
            {
                'detail': (
                    "Abonnement Isoko Hub inactif ou expiré. "
                    "Renouvelez votre abonnement pour continuer."
                ),
                'code': 'subscription_required',
            },
            status=402,
        )
