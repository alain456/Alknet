"""
Résolution de l'établissement à partir du sous-domaine.

biu.isokohub.com et biu.localhost désignent l'entreprise dont le slug est « biu ».
www, api et l'apex restent la plateforme. Un sous-domaine inconnu répond 404.
"""
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

from businesses.models import Business
from businesses.slug import RESERVED_SLUGS


class TenantSubdomainMiddleware(MiddlewareMixin):
    EXCLUDED_HOSTS = {
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        'testserver',
    }

    TENANT_DOMAIN_SUFFIXES = (
        '.isokohub.com',
        '.isoko-hub.com',
        '.localhost',
    )

    def process_request(self, request):
        host = request.get_host().split(':')[0].lower()
        request.tenant = None
        request.tenant_business = None
        request.tenant_subscription = None
        request.tenant_plan = None

        if host in self.EXCLUDED_HOSTS:
            return None

        tenant_slug = None
        for suffix in self.TENANT_DOMAIN_SUFFIXES:
            if host.endswith(suffix) and host != suffix[1:]:
                tenant_slug = host[:-len(suffix)]
                break

        if tenant_slug in RESERVED_SLUGS:
            return None
        if tenant_slug and '.' in tenant_slug:
            return JsonResponse({'detail': 'Établissement introuvable.'}, status=404)

        if tenant_slug:
            business = Business.objects.select_related(
                'primary_category', 'subscription__plan',
            ).filter(
                slug=tenant_slug,
                is_active=True,
                verification_status='APPROVED',
            ).first()
            if business is None:
                return JsonResponse({'detail': 'Établissement introuvable.'}, status=404)
        else:
            business = Business.objects.select_related(
                'primary_category', 'subscription__plan',
            ).filter(
                custom_domain__iexact=host,
                is_active=True,
                verification_status='APPROVED',
            ).first()
            if business is None:
                return None

        request.tenant = business
        request.tenant_business = business
        subscription = getattr(business, 'subscription', None)
        request.tenant_subscription = subscription
        request.tenant_plan = getattr(subscription, 'plan', None) if subscription else None
        return None


def get_request_tenant(request):
    """Établissement du sous-domaine, sinon celui du compte connecté."""
    tenant = getattr(request, 'tenant', None)
    if tenant:
        return tenant

    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        from businesses.tenant import get_user_tenant_business
        return get_user_tenant_business(user)

    return None
