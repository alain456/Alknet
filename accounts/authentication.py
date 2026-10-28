"""JWT lu dans le cookie HttpOnly, avec repli si l'en-tête Authorization n'est pas un jeton."""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken, TokenError

from .session_cookies import ACCESS_COOKIE


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw = self.get_raw_token(header)
            if raw:
                try:
                    validated = self.get_validated_token(raw)
                except (InvalidToken, TokenError):
                    validated = None
                else:
                    user = self.get_user(validated)
                    self._reject_unapproved_business(user)
                    return user, validated
        cookie = request.COOKIES.get(ACCESS_COOKIE)
        if not cookie:
            return None
        try:
            validated = self.get_validated_token(cookie)
        except (InvalidToken, TokenError):
            return None
        user = self.get_user(validated)
        self._reject_unapproved_business(user)
        return user, validated

    @staticmethod
    def _reject_unapproved_business(user):
        from businesses.login_gate import business_login_block_message
        blocked = business_login_block_message(user)
        if blocked:
            raise AuthenticationFailed(blocked)


def user_from_request(request):
    auth = CookieJWTAuthentication()
    try:
        result = auth.authenticate(request)
    except (InvalidToken, AuthenticationFailed, TokenError):
        return None
    if not result:
        return None
    return result[0]
