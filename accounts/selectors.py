from django.contrib.auth import get_user_model
from .email_identity import get_user_by_login_email, normalize_login_email

User = get_user_model()


def get_user_by_email(email: str):
    """
    Récupère un utilisateur par email de connexion — égalité STRICTE uniquement.
    """
    return get_user_by_login_email(email)
