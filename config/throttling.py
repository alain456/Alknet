"""Throttling DRF — assoupli pour la SPA publique (listes GET)."""
from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class SoftAnonRateThrottle(AnonRateThrottle):
    """En DEBUG : pas de limite anon (évite 429 en navigation locale)."""

    def allow_request(self, request, view):
        if settings.DEBUG:
            return True
        return super().allow_request(request, view)


class SoftUserRateThrottle(UserRateThrottle):
    """En DEBUG : limite très haute pour staff / clients connectés."""

    def allow_request(self, request, view):
        if settings.DEBUG:
            return True
        return super().allow_request(request, view)
