"""Validateurs de mot de passe Isoko Hub (longueur configurable)."""
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


DEFAULT_PASSWORD_MIN_LENGTH = 8


def get_password_min_length() -> int:
    """Lit la longueur min depuis SiteSettings (Super Admin), sinon défaut."""
    try:
        from site_content.models import SiteSettings

        obj = SiteSettings.objects.first()
        if obj is not None and obj.password_min_length:
            return max(4, min(int(obj.password_min_length), 128))
    except Exception:
        pass
    return DEFAULT_PASSWORD_MIN_LENGTH


class ConfigurableMinimumLengthValidator:
    """Équivalent de MinimumLengthValidator, mais piloté par SiteSettings."""

    def validate(self, password, user=None):
        min_length = get_password_min_length()
        if len(password) < min_length:
            raise ValidationError(
                _(
                    "Ce mot de passe est trop court. Il doit contenir au moins "
                    "%(min_length)d caractères."
                ),
                code="password_too_short",
                params={"min_length": min_length},
            )

    def get_help_text(self):
        return _(
            "Votre mot de passe doit contenir au moins %(min_length)d caractères."
        ) % {"min_length": get_password_min_length()}
