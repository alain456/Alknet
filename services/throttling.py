from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class ServicesPublicThrottle(SimpleRateThrottle):
    """Contact et avis : limite par IP, y compris hors DEBUG."""

    scope = 'services_public'

    def allow_request(self, request, view):
        if getattr(settings, 'IS_TESTING', False):
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}
