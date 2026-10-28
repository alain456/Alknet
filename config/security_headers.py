"""En-têtes de sécurité, dont une CSP stricte (un peu assouplie en développement pour Vite)."""
from django.conf import settings


def content_security_policy() -> str:
    images = "img-src 'self' data: blob: https:"
    common = (
        "default-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        f"{images}; "
        "font-src 'self' data:; "
        "object-src 'none'; "
        "media-src 'self' data: blob: https:; "
        "frame-src 'self' blob: https://www.openstreetmap.org https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'"
    )
    if settings.DEBUG:
        return (
            f"{common}; "
            "script-src 'self' 'unsafe-inline'; "
            "connect-src 'self' ws: wss: http: https:"
        )
    return (
        f"{common}; "
        "script-src 'self'; "
        "connect-src 'self'; "
        "upgrade-insecure-requests"
    )


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault('Content-Security-Policy', content_security_policy())
        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('Referrer-Policy', 'same-origin')
        return response
