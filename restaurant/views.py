from datetime import timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from business_categories.food_service import is_restaurant_business
from businesses.models import Business
from businesses.subscription import filter_businesses_with_active_subscription

from .models import MenuItem, RestaurantProfile, TableBooking
from .permissions import IsRestaurantManager, require_restaurant
from .serializers import (
    MenuItemSerializer,
    RestaurantProfileSerializer,
    TableBookingSerializer,
    TableBookingWriteSerializer,
    get_restaurant_profile,
    public_restaurant_payload,
    venue_kind_from_category,
)


def ensure_profile(business):
    extras = business.extra_attributes or {}
    defaults = {
        'trade_name': business.name,
        'venue_kind': venue_kind_from_category(business.primary_category),
        'cuisine_type': extras.get('cuisine_type') or '',
        'opening_hours': extras.get('opening_hours') or '',
        'description': business.description or '',
        'delivery': bool(extras.get('offers_delivery')),
    }
    profile, _ = RestaurantProfile.objects.get_or_create(business=business, defaults=defaults)
    return profile


def restaurant_directory_qs():
    qs = Business.objects.filter(
        is_active=True,
        is_verified=True,
        verification_status='APPROVED',
    ).select_related('primary_category', 'primary_category__parent', 'restaurant_profile')
    qs = filter_businesses_with_active_subscription(qs)
    qs = qs.filter(
        Q(primary_category__module='restaurant')
        | Q(primary_category__slug__in=['bar', 'cafe', 'restaurant', 'traiteur'])
        | Q(primary_category__name__icontains='restaurant')
        | Q(primary_category__name__icontains='traiteur')
        | Q(primary_category__name__icontains='café')
        | Q(primary_category__name__icontains='cafe')
        | Q(primary_category__name__iexact='Bar')
    )
    return qs.exclude(restaurant_profile__status__in=['SUSPENDED', 'CLOSED'])


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsRestaurantManager])
def profile_me(request):
    business = require_restaurant(request)
    profile = ensure_profile(business)
    if request.method == 'PATCH':
        ser = RestaurantProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        profile.refresh_from_db()
    data = RestaurantProfileSerializer(profile).data
    data['business_id'] = str(business.id)
    data['business_name'] = business.name
    data['logo'] = business.logo or ''
    data['address'] = business.full_address
    data['phone'] = business.phone
    data['email'] = business.email
    data['website'] = business.website
    data['latitude'] = business.latitude
    data['longitude'] = business.longitude
    data['category_name'] = getattr(business.primary_category, 'name', '') or ''
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRestaurantManager])
def dashboard(request):
    business = require_restaurant(request)
    ensure_profile(business)
    now = timezone.now()
    bookings = TableBooking.objects.filter(restaurant=business)
    pending = bookings.filter(status='PENDING').count()
    upcoming = bookings.filter(
        status='CONFIRMED', booked_for__gte=now, booked_for__lt=now + timedelta(days=7),
    ).count()
    menu_count = MenuItem.objects.filter(restaurant=business, is_available=True).count()
    today = bookings.filter(booked_for__date=now.date()).exclude(status='CANCELLED').count()
    recent = bookings.order_by('-created_at')[:8]
    return Response({
        'name': business.name,
        'pending_bookings': pending,
        'upcoming_week': upcoming,
        'menu_items': menu_count,
        'today_covers': today,
        'recent': TableBookingSerializer(recent, many=True).data,
    })


class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [IsAuthenticated, IsRestaurantManager]

    def get_queryset(self):
        return MenuItem.objects.filter(restaurant=require_restaurant(self.request))

    def perform_create(self, serializer):
        serializer.save(restaurant=require_restaurant(self.request))


class TableBookingViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TableBookingSerializer
    permission_classes = [IsAuthenticated, IsRestaurantManager]

    def get_queryset(self):
        qs = TableBooking.objects.filter(restaurant=require_restaurant(self.request))
        status_filter = (self.request.query_params.get('status') or '').upper()
        if status_filter in dict(TableBooking.STATUS_CHOICES):
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        booking = self.get_object()
        if booking.status != 'PENDING':
            raise ValidationError('Seule une demande en attente peut être confirmée.')
        booking.status = 'CONFIRMED'
        booking.manager_note = (request.data.get('manager_note') or booking.manager_note or '')[:2000]
        booking.save(update_fields=['status', 'manager_note', 'updated_at'])
        return Response(TableBookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def refuse(self, request, pk=None):
        booking = self.get_object()
        if booking.status != 'PENDING':
            raise ValidationError('Seule une demande en attente peut être refusée.')
        booking.status = 'REFUSED'
        booking.manager_note = (request.data.get('manager_note') or '').strip() or booking.manager_note
        booking.save(update_fields=['status', 'manager_note', 'updated_at'])
        return Response(TableBookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        if booking.status in ('REFUSED', 'CANCELLED'):
            raise ValidationError('Cette réservation est déjà close.')
        booking.status = 'CANCELLED'
        booking.manager_note = (request.data.get('manager_note') or booking.manager_note or '')[:2000]
        booking.save(update_fields=['status', 'manager_note', 'updated_at'])
        return Response(TableBookingSerializer(booking).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_venues(request):
    qs = restaurant_directory_qs()
    q = (request.query_params.get('q') or '').strip()
    destination = (request.query_params.get('destination') or '').strip()
    kind = (request.query_params.get('venue_kind') or '').strip().upper()
    if q:
        qs = qs.filter(
            Q(name__icontains=q)
            | Q(description__icontains=q)
            | Q(restaurant_profile__trade_name__icontains=q)
            | Q(restaurant_profile__cuisine_type__icontains=q)
        )
    if destination:
        qs = qs.filter(
            Q(province__icontains=destination)
            | Q(commune__icontains=destination)
            | Q(zone__icontains=destination)
            | Q(quartier__icontains=destination)
            | Q(address__icontains=destination)
        )
    if kind in dict(RestaurantProfile.VENUE_KINDS):
        qs = qs.filter(
            Q(restaurant_profile__venue_kind=kind)
            | Q(restaurant_profile__isnull=True, primary_category__name__icontains={
                'RESTAURANT': 'restaurant', 'BAR': 'bar', 'CAFE': 'café', 'TRAITEUR': 'traiteur',
            }.get(kind, kind))
        )
    rows = []
    for business in qs.order_by('name')[:80]:
        if not is_restaurant_business(business):
            continue
        rows.append(public_restaurant_payload(business, get_restaurant_profile(business)))
    return Response(rows)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_venue_detail(request, venue_id):
    business = get_object_or_404(
        restaurant_directory_qs(),
        pk=venue_id,
    )
    if not is_restaurant_business(business):
        return Response({'detail': 'Introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    menu = MenuItem.objects.filter(restaurant=business, is_available=True)
    return Response(public_restaurant_payload(
        business, get_restaurant_profile(business), menu,
    ))


@api_view(['POST'])
@permission_classes([AllowAny])
def public_book(request, venue_id):
    business = get_object_or_404(restaurant_directory_qs(), pk=venue_id)
    if not is_restaurant_business(business):
        return Response({'detail': 'Introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    profile = get_restaurant_profile(business)
    if profile and not profile.reservations_open:
        raise ValidationError('Les réservations de table sont fermées pour le moment.')
    ser = TableBookingWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    booked_for = ser.validated_data['booked_for']
    if booked_for < timezone.now() - timedelta(minutes=5):
        raise ValidationError({'booked_for': 'Choisissez une date et une heure à venir.'})
    party = ser.validated_data.get('party_size') or 2
    if party < 1 or party > 40:
        raise ValidationError({'party_size': 'Le nombre de convives doit être entre 1 et 40.'})
    user = request.user if request.user.is_authenticated else None
    booking = TableBooking.objects.create(
        restaurant=business,
        user=user,
        **ser.validated_data,
    )
    return Response(TableBookingSerializer(booking).data, status=status.HTTP_201_CREATED)
