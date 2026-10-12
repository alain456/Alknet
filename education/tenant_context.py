"""Établissement demandé par l'en-tête, lu seulement si le drapeau est ouvert."""
import contextvars

education_business_id = contextvars.ContextVar('education_business_id', default='')


class EducationTenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = education_business_id.set(
            (request.headers.get('X-Education-Business') or '').strip(),
        )
        try:
            return self.get_response(request)
        finally:
            education_business_id.reset(token)
