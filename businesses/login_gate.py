"""Un gérant d'entreprise ne se connecte qu'après approbation du dossier."""
from django.core.exceptions import ObjectDoesNotExist

PENDING_LOGIN_MESSAGE = (
    "Votre entreprise n’a pas encore été approuvée. "
    "Vous pourrez vous connecter dès que l’équipe Isoko Hub aura validé le dossier."
)
REJECTED_LOGIN_MESSAGE = (
    "L’inscription de votre entreprise a été refusée. "
    "Vous ne pouvez pas vous connecter tant que le dossier n’est pas approuvé."
)

_PLATFORM_ROLES = {
    'SUPER_ADMIN',
    'PLATFORM_FINANCE',
    'PLATFORM_MODERATION',
    'PLATFORM_SUPPORT',
    'PLATFORM_CONTENT',
    'CUSTOMER',
}
_BUSINESS_ROLES = {'BUSINESS_OWNER', 'PROFESSIONAL'}


def related_verification_statuses(user):
    from .models import Business, BusinessEmployee

    statuses = list(
        Business.objects.filter(owner=user).values_list('verification_status', flat=True)
    )
    statuses.extend(
        BusinessEmployee.objects.filter(user=user, is_active=True).values_list(
            'business__verification_status', flat=True,
        )
    )
    try:
        hospital_id = user.doctor_profile.hospital_id
    except (ObjectDoesNotExist, AttributeError):
        hospital_id = None
    if hospital_id:
        hospital_status = (
            Business.objects.filter(pk=hospital_id)
            .values_list('verification_status', flat=True)
            .first()
        )
        if hospital_status:
            statuses.append(hospital_status)
    return statuses


def business_login_block_message(user):
    """Message de refus, ou None si la connexion métier est autorisée."""
    if not user:
        return None
    role = getattr(user, 'role', None)
    if role in _PLATFORM_ROLES or role not in _BUSINESS_ROLES:
        return None
    statuses = related_verification_statuses(user)
    if not statuses or 'APPROVED' in statuses:
        return None
    if 'PENDING' in statuses:
        return PENDING_LOGIN_MESSAGE
    return REJECTED_LOGIN_MESSAGE
