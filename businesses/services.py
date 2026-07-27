from django.contrib.auth import get_user_model
from .models import Business
from business_categories.models import BusinessCategory

User = get_user_model()

def create_business(*, owner: User, name: str, category: BusinessCategory, **extra_fields) -> Business:
    business = Business.objects.create(
        owner=owner,
        name=name,
        category=category,
        **extra_fields
    )
    return business

def update_business(*, business: Business, **fields) -> Business:
    for field, value in fields.items():
        setattr(business, field, value)
    business.save()
    return business
