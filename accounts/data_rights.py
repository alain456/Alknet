"""Export et suppression des données personnelles, export établissement."""
from django.contrib.auth.hashers import check_password


def export_personal_data(user):
    from businesses.models import Business, BusinessEmployee
    owned = list(Business.objects.filter(owner=user).values('id', 'name', 'province', 'commune'))
    jobs = list(BusinessEmployee.objects.filter(user=user).values('business_id', 'position', 'is_active'))
    return {
        'account': {
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone_number': user.phone_number,
            'role': user.role,
            'created_at': user.created_at.isoformat() if user.created_at else None,
        },
        'owned_businesses': [{**row, 'id': str(row['id'])} for row in owned],
        'employments': [{**row, 'business_id': str(row['business_id'])} for row in jobs],
    }


def delete_personal_account(user, password):
    if user.role == 'SUPER_ADMIN' or user.is_superuser:
        return 'Le compte administrateur plateforme ne se supprime pas ici.'
    if not check_password(password or '', user.password):
        return 'Mot de passe incorrect.'
    from businesses.models import Business
    if Business.objects.filter(owner=user).exists():
        return "Transférez ou fermez d'abord les entreprises dont vous êtes propriétaire."
    user.is_active = False
    user.email = f'deleted-{user.id}@invalid.local'
    user.first_name = ''
    user.last_name = ''
    user.phone_number = ''
    user.set_unusable_password()
    user.save()
    return None


def export_business_data(business):
    from services.models import Service
    services = list(Service.objects.filter(business=business).values('id', 'title', 'price', 'status'))
    return {
        'business': {
            'id': str(business.id),
            'name': business.name,
            'description': business.description,
            'province': business.province,
            'commune': business.commune,
            'phone': business.phone,
            'email': business.email,
        },
        'services': [
            {**row, 'id': str(row['id']), 'price': str(row['price']) if row['price'] is not None else None}
            for row in services
        ],
    }
