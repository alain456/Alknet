from rest_framework import serializers

from .models import MenuItem, RestaurantProfile, TableBooking


class RestaurantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantProfile
        fields = (
            'id', 'trade_name', 'venue_kind', 'cuisine_type', 'seats',
            'opening_hours', 'description', 'status', 'takeaway', 'delivery',
            'reservations_open', 'price_range', 'gallery',
        )


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = (
            'id', 'name', 'description', 'section', 'price', 'currency',
            'is_available', 'sort_order',
        )


class TableBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TableBooking
        fields = (
            'id', 'guest_name', 'guest_phone', 'guest_email', 'party_size',
            'booked_for', 'status', 'notes', 'manager_note', 'created_at',
        )
        read_only_fields = ('status', 'manager_note', 'created_at')


class TableBookingWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TableBooking
        fields = (
            'guest_name', 'guest_phone', 'guest_email', 'party_size',
            'booked_for', 'notes',
        )


def venue_kind_from_category(category):
    name = (getattr(category, 'name', '') or '').lower().strip()
    slug = (getattr(category, 'slug', '') or '').lower().strip()
    blob = f'{name} {slug}'
    if 'traiteur' in blob:
        return 'TRAITEUR'
    if slug == 'bar' or name == 'bar':
        return 'BAR'
    if 'café' in blob or 'cafe' in blob:
        return 'CAFE'
    return 'RESTAURANT'


def get_restaurant_profile(business):
    try:
        return business.restaurant_profile
    except RestaurantProfile.DoesNotExist:
        return None
    except AttributeError:
        return None


def public_restaurant_payload(business, profile=None, menu=None):
    category = getattr(business, 'primary_category', None)
    profile = profile or get_restaurant_profile(business)
    extras = business.extra_attributes or {}
    kind = getattr(profile, 'venue_kind', None) or venue_kind_from_category(category)
    labels = dict(RestaurantProfile.VENUE_KINDS)
    return {
        'id': str(business.id),
        'name': business.name,
        'trade_name': (profile.trade_name if profile else '') or business.name,
        'logo': business.logo or '',
        'description': (profile.description if profile else '') or business.description or '',
        'venue_kind': kind,
        'venue_kind_label': labels.get(kind, 'Restaurant'),
        'cuisine_type': (profile.cuisine_type if profile else '') or extras.get('cuisine_type') or '',
        'seats': profile.seats if profile else None,
        'opening_hours': (profile.opening_hours if profile else '') or extras.get('opening_hours') or '',
        'takeaway': profile.takeaway if profile else False,
        'delivery': profile.delivery if profile else bool(extras.get('offers_delivery')),
        'reservations_open': profile.reservations_open if profile else True,
        'price_range': profile.price_range if profile else '',
        'gallery': list(profile.gallery or []) if profile else [],
        'address': business.full_address,
        'province': business.province,
        'commune': business.commune,
        'phone': business.phone,
        'email': business.email,
        'website': business.website,
        'latitude': business.latitude,
        'longitude': business.longitude,
        'category_name': getattr(category, 'name', '') or '',
        'status': profile.status if profile else 'ACTIVE',
        'menu': MenuItemSerializer(menu or [], many=True).data,
    }
