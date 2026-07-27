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
