from rest_framework import serializers
from .models import (
    HotelProfile, HotelDepartment, RoomType, Room, RatePlan, Guest,
    Reservation, Stay, HotelService, Folio, FolioItem, Payment,
    HotelInvoice, HousekeepingTask, MaintenanceTicket, HotelAuditLog, CashClosing,
)
from .services import compute_total, assert_room_assignable, next_reference


class HotelProfileSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    address = serializers.CharField(source='business.address', read_only=True)
    phone = serializers.CharField(source='business.phone', read_only=True)
    email = serializers.CharField(source='business.email', read_only=True)
    city = serializers.SerializerMethodField()
    display_stars = serializers.IntegerField(read_only=True)
    latitude = serializers.FloatField(source='business.latitude', read_only=True, allow_null=True)
    longitude = serializers.FloatField(source='business.longitude', read_only=True, allow_null=True)
    website = serializers.CharField(source='business.website', read_only=True)

    class Meta:
        model = HotelProfile
        fields = (
            'id', 'business', 'business_name', 'trade_name', 'establishment_type',
            'stars', 'stars_verified', 'classification_verified', 'display_stars',
            'license_number', 'status', 'check_in_time', 'check_out_time',
            'customer_service_hours', 'languages', 'currency', 'amenities',
            'cancellation_policy', 'stay_conditions', 'pets_allowed', 'smoking_allowed',
            'deposit_policy', 'guest_info', 'reference_prefix',
            'reservation_request_email_message',
            'reservation_confirm_email_message',
            'reservation_reject_email_message',
            'check_in_email_message',
            'check_out_email_message',
            'address', 'phone', 'email', 'city', 'website', 'latitude', 'longitude',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'business', 'created_at', 'updated_at',
            'stars_verified', 'classification_verified', 'display_stars',
            'latitude', 'longitude', 'website',
        )

    def get_city(self, obj):
        b = obj.business
        return getattr(b, 'commune', None) or getattr(b, 'province', None) or ''


class HotelDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelDepartment
        fields = ('id', 'hotel', 'name', 'is_active')
        read_only_fields = ('id', 'hotel')


class RoomTypeSerializer(serializers.ModelSerializer):
    rooms_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = RoomType
        fields = (
            'id', 'hotel', 'name', 'description', 'capacity_adults', 'capacity_children',
            'bed_configuration', 'surface_m2', 'amenities', 'base_price', 'photos', 'category',
            'is_active', 'created_at', 'rooms_count',
        )
        read_only_fields = ('id', 'hotel', 'created_at', 'rooms_count')


class RoomSerializer(serializers.ModelSerializer):
    room_type_name = serializers.CharField(source='room_type.name', read_only=True)

    class Meta:
        model = Room
        fields = (
            'id', 'hotel', 'room_type', 'room_type_name', 'number', 'floor',
            'operational_status', 'housekeeping_status', 'maintenance_status',
            'amenities', 'commissioned_at', 'is_active', 'created_at',
        )
        read_only_fields = ('id', 'hotel', 'created_at')


class RatePlanSerializer(serializers.ModelSerializer):
    room_type_name = serializers.CharField(source='room_type.name', read_only=True)

    class Meta:
        model = RatePlan
        fields = (
            'id', 'hotel', 'room_type', 'room_type_name', 'name', 'rate_kind',
            'price_per_night', 'currency', 'valid_from', 'valid_to', 'min_nights',
            'includes_breakfast', 'taxes_included', 'cancellation_policy', 'is_active',
        )
        read_only_fields = ('id', 'hotel')


class GuestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guest
        fields = (
            'id', 'hotel', 'user', 'first_name', 'last_name', 'phone', 'email',
            'nationality', 'identity_reference', 'notes', 'created_at',
        )
        read_only_fields = ('id', 'hotel', 'created_at')


class GuestWriteSerializer(serializers.Serializer):
    """Payload voyageur à la création de réservation (sans ID guest)."""
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True, default='')
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    nationality = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')
    identity_reference = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class FolioItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FolioItem
        fields = (
            'id', 'folio', 'item_type', 'description', 'quantity', 'unit_price',
            'total', 'hotel_service', 'added_by', 'created_at',
        )
        read_only_fields = ('id', 'total', 'added_by', 'created_at')


class PaymentSerializer(serializers.ModelSerializer):
    guest_name = serializers.SerializerMethodField()
    reservation_ref = serializers.CharField(
        source='folio.stay.reservation.reference', read_only=True, default='',
    )
    room_number = serializers.CharField(
        source='folio.stay.room.number', read_only=True, default='',
    )

    class Meta:
        model = Payment
        fields = (
            'id', 'folio', 'amount', 'method', 'status', 'reference',
            'received_by', 'paid_at', 'notes',
            'guest_name', 'reservation_ref', 'room_number',
        )
        read_only_fields = (
            'id', 'received_by', 'paid_at',
            'guest_name', 'reservation_ref', 'room_number',
        )

    def get_guest_name(self, obj):
        folio = getattr(obj, 'folio', None)
        guest = getattr(folio, 'guest', None) if folio else None
        if not guest:
            return ''
        return f'{guest.first_name or ""} {guest.last_name or ""}'.strip()


class FolioSerializer(serializers.ModelSerializer):
    items = FolioItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.CharField(source='guest.phone', read_only=True, default='')
    guest_email = serializers.CharField(source='guest.email', read_only=True, default='')
    reservation_ref = serializers.CharField(
        source='stay.reservation.reference', read_only=True, default='',
    )
    room_number = serializers.CharField(source='stay.room.number', read_only=True, default='')
    stay_status = serializers.CharField(source='stay.status', read_only=True, default='')
    check_in_date = serializers.DateField(
        source='stay.reservation.check_in_date', read_only=True, default=None,
    )
    check_out_date = serializers.DateField(
        source='stay.reservation.check_out_date', read_only=True, default=None,
    )

    class Meta:
        model = Folio
        fields = (
            'id', 'stay', 'guest', 'guest_name', 'guest_phone', 'guest_email',
            'reservation_ref', 'room_number', 'stay_status',
            'check_in_date', 'check_out_date',
            'status', 'subtotal', 'taxes', 'discounts',
            'total', 'paid_amount', 'balance', 'currency', 'items', 'payments',
            'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_guest_name(self, obj):
        g = obj.guest
        if not g:
            return ''
        return f'{g.first_name or ""} {g.last_name or ""}'.strip()


class ReservationSerializer(serializers.ModelSerializer):
    guest_name = serializers.SerializerMethodField()
    has_client_message = serializers.SerializerMethodField()
    client_message_pending = serializers.SerializerMethodField()
    guest_phone = serializers.CharField(source='guest.phone', read_only=True, default='')
    guest_email = serializers.CharField(source='guest.email', read_only=True, default='')
    room_number = serializers.CharField(source='room.number', read_only=True, default='')
    room_type_name = serializers.CharField(source='room_type.name', read_only=True)
    room_type_capacity_adults = serializers.IntegerField(
        source='room_type.capacity_adults', read_only=True, default=1,
    )
    room_type_capacity_children = serializers.IntegerField(
        source='room_type.capacity_children', read_only=True, default=0,
    )
    nights = serializers.IntegerField(read_only=True)
    guest = serializers.PrimaryKeyRelatedField(
        queryset=Guest.objects.all(), required=False, allow_null=True,
    )
    guest_data = GuestWriteSerializer(required=False, write_only=True)
    # Compat formulaire : prénom/nom à plat (comme public_book)
    first_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    last_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Reservation
        fields = (
            'id', 'reference', 'hotel', 'guest', 'guest_name', 'guest_phone', 'guest_email',
            'guest_data', 'first_name', 'last_name', 'phone', 'email',
            'room_type', 'room_type_name', 'room_type_capacity_adults', 'room_type_capacity_children',
            'room', 'room_number', 'rate_plan',
            'check_in_date', 'check_out_date', 'nights', 'adults', 'children',
            'status', 'source', 'special_requests', 'internal_notes',
            'has_client_message', 'client_message_pending',
            'decision_note', 'decision_at',
            'reschedule_status', 'reschedule_preferred_check_in', 'reschedule_preferred_check_out',
            'reschedule_reason', 'reschedule_admin_note',
            'reschedule_requested_at', 'reschedule_resolved_at',
            'departure_reminder_sent_at', 'departure_reminder_note',
            'amount_per_night', 'total_amount', 'currency',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_provider_reference', 'payment_merchant_account',
            'paid_at', 'payment_note',
            'created_by', 'created_at', 'updated_at',
        )
        extra_kwargs = {
            'guest': {'required': False, 'allow_null': True},
            'room': {'required': False, 'allow_null': True},
            'rate_plan': {'required': False, 'allow_null': True},
        }
        read_only_fields = (
            'id', 'reference', 'hotel', 'total_amount',
            'guest_phone', 'guest_email',
            'has_client_message', 'client_message_pending',
            'room_type_capacity_adults', 'room_type_capacity_children',
            'decision_note', 'decision_at',
            'reschedule_status', 'reschedule_preferred_check_in', 'reschedule_preferred_check_out',
            'reschedule_reason', 'reschedule_admin_note',
            'reschedule_requested_at', 'reschedule_resolved_at',
            'departure_reminder_sent_at', 'departure_reminder_note',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_provider_reference', 'payment_merchant_account',
            'paid_at', 'payment_note',
            'created_by', 'created_at', 'updated_at',
        )

    def get_guest_name(self, obj):
        return f'{obj.guest.first_name} {obj.guest.last_name}'

    def get_has_client_message(self, obj):
        from .client_messages import has_client_message
        return has_client_message(obj.special_requests or '')

    def get_client_message_pending(self, obj):
        from .client_messages import client_message_pending
        return client_message_pending(obj.special_requests or '')

    def validate(self, attrs):
        check_in = attrs.get('check_in_date') or getattr(self.instance, 'check_in_date', None)
        check_out = attrs.get('check_out_date') or getattr(self.instance, 'check_out_date', None)
        if check_in and check_out and check_out <= check_in:
            raise serializers.ValidationError({'check_out_date': 'Départ doit être après l\'arrivée.'})

        # Création : guest existant OU guest_data OU prénom/nom à plat
        if not self.instance:
            guest = attrs.get('guest')
            guest_data = attrs.get('guest_data')
            flat_first = (attrs.get('first_name') or '').strip()
            flat_last = (attrs.get('last_name') or '').strip()
            if not guest and not guest_data and not (flat_first and flat_last):
                raise serializers.ValidationError({
                    'guest': 'Indiquez le client (prénom et nom requis).',
                })
            if guest_data and not (guest_data.get('first_name') or '').strip():
                raise serializers.ValidationError({
                    'guest_data': {'first_name': 'Prénom requis.'},
                })

        room_type = attrs.get('room_type') or getattr(self.instance, 'room_type', None)
        adults = attrs.get('adults', getattr(self.instance, 'adults', 1) if self.instance else 1)
        children = attrs.get('children', getattr(self.instance, 'children', 0) if self.instance else 0)
        try:
            adults = int(adults or 1)
            children = int(children or 0)
        except (TypeError, ValueError):
            raise serializers.ValidationError({'adults': 'Nombre d\'occupants invalide.'})

        if room_type is not None:
            cap_a = int(getattr(room_type, 'capacity_adults', 0) or 0)
            cap_c = int(getattr(room_type, 'capacity_children', 0) or 0)
            if cap_a and adults > cap_a:
                raise serializers.ValidationError({
                    'adults': f'Ce type de chambre accepte au maximum {cap_a} adulte(s).',
                })
            if children > cap_c:
                raise serializers.ValidationError({
                    'children': f'Ce type de chambre accepte au maximum {cap_c} enfant(s).',
                })

        rate_plan = attrs.get('rate_plan', serializers.empty)
        if rate_plan is serializers.empty:
            rate_plan = getattr(self.instance, 'rate_plan', None) if self.instance else None
        # Création : si pas de tarif choisi, résolution auto (base_price → RatePlan)
        if not self.instance and not rate_plan and room_type is not None:
            from .rate_resolution import resolve_rate_plan
            hotel = self.context.get('hotel')
            if hotel:
                rate_plan, _meta = resolve_rate_plan(hotel, room_type, auto_create=True, notify=True)
                if rate_plan:
                    attrs['rate_plan'] = rate_plan
        if not self.instance and not attrs.get('rate_plan') and not rate_plan:
            raise serializers.ValidationError({
                'rate_plan': (
                    'Ce type de chambre n’est pas encore disponible à la réservation. '
                    'Choisissez un autre type ou réessayez plus tard.'
                ),
            })
        rate_plan = attrs.get('rate_plan', rate_plan)
        if rate_plan and room_type and rate_plan.room_type_id != room_type.id:
            raise serializers.ValidationError({
                'rate_plan': 'Ce tarif ne correspond pas au type de chambre choisi.',
            })
        if rate_plan and not rate_plan.is_active:
            raise serializers.ValidationError({'rate_plan': 'Ce tarif est inactif.'})

        room = attrs.get('room')
        if room is not None:
            exclude = self.instance.id if self.instance else None
            assert_room_assignable(room, check_in, check_out, exclude)
        return attrs

    def create(self, validated_data):
        guest_data = validated_data.pop('guest_data', None)
        flat_first = (validated_data.pop('first_name', None) or '').strip()
        flat_last = (validated_data.pop('last_name', None) or '').strip()
        flat_phone = (validated_data.pop('phone', None) or '').strip()
        flat_email = (validated_data.pop('email', None) or '').strip()
        hotel = self.context['hotel']

        if guest_data:
            guest = Guest.objects.create(
                hotel=hotel,
                first_name=(guest_data.get('first_name') or '').strip(),
                last_name=(guest_data.get('last_name') or '').strip(),
                phone=(guest_data.get('phone') or '').strip(),
                email=(guest_data.get('email') or '').strip(),
                nationality=(guest_data.get('nationality') or '').strip(),
                identity_reference=(guest_data.get('identity_reference') or '').strip(),
                notes=(guest_data.get('notes') or '').strip(),
            )
            validated_data['guest'] = guest
        elif flat_first and flat_last:
            guest = Guest.objects.create(
                hotel=hotel,
                first_name=flat_first,
                last_name=flat_last,
                phone=flat_phone,
                email=flat_email,
            )
            validated_data['guest'] = guest
        elif not validated_data.get('guest'):
            raise serializers.ValidationError({
                'guest': 'Client requis pour créer la réservation.',
            })

        # room vide → None
        if validated_data.get('room') in ('', None):
            validated_data['room'] = None

        rate = validated_data.get('rate_plan')
        if not rate:
            from .rate_resolution import resolve_rate_plan
            rate, _meta = resolve_rate_plan(
                hotel, validated_data.get('room_type'), auto_create=True, notify=True,
            )
            if rate:
                validated_data['rate_plan'] = rate
        if not rate:
            raise serializers.ValidationError({
                'rate_plan': (
                    'Ce type de chambre n’est pas encore disponible à la réservation. '
                    'Choisissez un autre type ou réessayez plus tard.'
                ),
            })
        # Prix toujours issu du tarif — jamais saisi manuellement
        validated_data['amount_per_night'] = rate.price_per_night
        validated_data['currency'] = rate.currency or validated_data.get('currency') or 'BIF'

        total, _ = compute_total(
            validated_data['amount_per_night'],
            validated_data['check_in_date'],
            validated_data['check_out_date'],
        )
        validated_data['total_amount'] = total
        validated_data['hotel'] = hotel
        validated_data['reference'] = next_reference(hotel, 'RES')
        validated_data['created_by'] = self.context['request'].user
        from .reservation_payment import apply_payment_snapshot
        reservation = super().create(validated_data)
        apply_payment_snapshot(reservation)
        reservation.save(update_fields=[
            'currency', 'payment_status', 'payment_method', 'paid_at',
            'payment_note', 'payment_merchant_account', 'updated_at',
        ])
        return reservation

    def update(self, instance, validated_data):
        validated_data.pop('guest_data', None)
        validated_data.pop('first_name', None)
        validated_data.pop('last_name', None)
        validated_data.pop('phone', None)
        validated_data.pop('email', None)
        rate = validated_data.get('rate_plan', instance.rate_plan)
        if rate:
            validated_data['amount_per_night'] = rate.price_per_night
            validated_data['currency'] = rate.currency or instance.currency or 'BIF'
        amount = validated_data.get('amount_per_night', instance.amount_per_night)
        check_in = validated_data.get('check_in_date', instance.check_in_date)
        check_out = validated_data.get('check_out_date', instance.check_out_date)
        total, _ = compute_total(amount, check_in, check_out)
        validated_data['total_amount'] = total
        return super().update(instance, validated_data)


class StaySerializer(serializers.ModelSerializer):
    guest_name = serializers.SerializerMethodField()
    room_number = serializers.CharField(source='room.number', read_only=True)
    reservation_ref = serializers.CharField(source='reservation.reference', read_only=True)
    folio = FolioSerializer(read_only=True)

    class Meta:
        model = Stay
        fields = (
            'id', 'reservation', 'reservation_ref', 'hotel', 'guest', 'guest_name',
            'room', 'room_number', 'actual_check_in', 'actual_check_out', 'status',
            'notes', 'previous_room', 'folio', 'created_at',
        )
        read_only_fields = (
            'id', 'reservation', 'hotel', 'guest', 'room', 'actual_check_in',
            'actual_check_out', 'status', 'previous_room', 'created_at',
        )

    def get_guest_name(self, obj):
        return f'{obj.guest.first_name} {obj.guest.last_name}'


class HotelServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelService
        fields = (
            'id', 'hotel', 'name', 'description', 'unit_price', 'unit', 'currency', 'is_active',
        )
        read_only_fields = ('id', 'hotel')


class HotelInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelInvoice
        fields = (
            'id', 'number', 'hotel', 'stay', 'folio', 'guest_name', 'period_start', 'period_end',
            'subtotal', 'taxes', 'discounts', 'total', 'paid_amount', 'balance',
            'currency', 'status', 'snapshot', 'issued_at', 'issued_by',
        )
        read_only_fields = fields


class HousekeepingTaskSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.number', read_only=True)
    assigned_to_email = serializers.CharField(source='assigned_to.email', read_only=True, default='')

    class Meta:
        model = HousekeepingTask
        fields = (
            'id', 'hotel', 'room', 'room_number', 'assigned_to', 'assigned_to_email',
            'task_type', 'priority', 'status', 'started_at', 'completed_at', 'comment', 'created_at',
        )
        read_only_fields = ('id', 'hotel', 'created_at')


class MaintenanceTicketSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.number', read_only=True, default='')

    class Meta:
        model = MaintenanceTicket
        fields = (
            'id', 'hotel', 'room', 'room_number', 'category', 'description', 'priority',
            'status', 'blocks_room', 'assigned_to', 'opened_by', 'cost', 'comment',
            'opened_at', 'resolved_at',
        )
        read_only_fields = ('id', 'hotel', 'opened_by', 'opened_at')


class HotelAuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', read_only=True, default='')

    class Meta:
        model = HotelAuditLog
        fields = (
            'id', 'hotel', 'actor', 'actor_email', 'action', 'entity_type',
            'entity_id', 'old_value', 'new_value', 'created_at',
        )
        read_only_fields = fields


class CashClosingSerializer(serializers.ModelSerializer):
    closed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CashClosing
        fields = (
            'id', 'hotel', 'period_date', 'total_collected', 'breakdown', 'notes',
            'closed_by', 'closed_by_name', 'closed_at', 'is_locked',
        )
        read_only_fields = (
            'id', 'hotel', 'total_collected', 'breakdown', 'closed_by',
            'closed_by_name', 'closed_at', 'is_locked',
        )

    def get_closed_by_name(self, obj):
        u = obj.closed_by
        if not u:
            return ''
        return (u.first_name or u.email or '').strip()
