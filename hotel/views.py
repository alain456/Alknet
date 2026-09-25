import csv
import io
from datetime import date, datetime, timedelta
from decimal import Decimal
from django.db.models import Sum, Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied

from businesses.tenant import get_user_tenant_business
from .models import (
    HotelProfile, HotelDepartment, RoomType, Room, RatePlan, Guest,
    Reservation, Stay, HotelService, Folio, Payment, HotelInvoice,
    HousekeepingTask, MaintenanceTicket, HotelAuditLog, CashClosing,
)
from .serializers import (
    HotelProfileSerializer, HotelDepartmentSerializer, RoomTypeSerializer,
    RoomSerializer, RatePlanSerializer, GuestSerializer, ReservationSerializer,
    StaySerializer, HotelServiceSerializer, FolioSerializer, PaymentSerializer,
    HotelInvoiceSerializer, HousekeepingTaskSerializer, MaintenanceTicketSerializer,
    HotelAuditLogSerializer, CashClosingSerializer,
)
from .permissions import (
    IsHotelTenant, IsHotelAdmin, IsHotelStaff, IsFrontDeskOrAdmin, IsCashierOrAdmin,
    IsReservationsOrFrontDesk, IsPlatformHotelAdmin, IsHousekeepingStaff, IsMaintenanceOrAdmin,
    HotelCrudPermission, IsHotelRolesManager,
    user_hotel_business, is_hotel_admin, is_front_desk, is_cashier, is_housekeeping,
    is_housekeeping_lead, is_maintenance, is_reservations_agent, can_access_hotel_roles,
    can_platform_hotel_suspend, can_platform_hotel_verify,
)
from .role_defaults import seed_hotel_default_roles
from .services import (
    available_rooms, check_in_reservation, check_out_stay, add_service_to_stay,
    record_payment, audit, assert_room_assignable,
)
from .rate_resolution import resolve_rate_plan, synthetic_rates_for_public


def _hotel(request):
    business = user_hotel_business(request.user)
    if not business:
        raise PermissionDenied('Aucun hôtel rattaché.')
    return business


class TenantHotelMixin:
    permission_classes = [IsAuthenticated, IsHotelStaff]

    def get_hotel(self):
        return _hotel(self.request)

    def get_queryset(self):
        return self.queryset.filter(hotel=self.get_hotel())

    def perform_create(self, serializer):
        serializer.save(hotel=self.get_hotel())


class HotelProfileViewSet(viewsets.ModelViewSet):
    serializer_class = HotelProfileSerializer
    permission_classes = [IsAuthenticated, IsHotelStaff]
    http_method_names = ['get', 'put', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        hotel = _hotel(self.request)
        HotelProfile.objects.get_or_create(business=hotel)
        seed_hotel_default_roles(hotel)
        return HotelProfile.objects.filter(business=hotel)

    def get_permissions(self):
        if self.action == 'seed_roles':
            return [IsAuthenticated(), IsHotelRolesManager()]
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsHotelAdmin()]
        return super().get_permissions()

    @action(detail=False, methods=['get', 'patch'], url_path='me')
    def me(self, request):
        hotel = _hotel(request)
        profile, _ = HotelProfile.objects.get_or_create(business=hotel)
        seed_hotel_default_roles(hotel)
        if request.method == 'PATCH':
            # Admin : tout ; agent réservations / réception : messages email de leur périmètre
            reservation_email_keys = {
                'reservation_request_email_message',
                'reservation_confirm_email_message',
                'reservation_reject_email_message',
            }
            front_desk_email_keys = {
                'check_in_email_message',
                'check_out_email_message',
            }
            if is_hotel_admin(request.user, hotel):
                data = request.data
            elif is_reservations_agent(request.user, hotel) and is_front_desk(request.user, hotel):
                allowed = reservation_email_keys | front_desk_email_keys
                data = {k: v for k, v in request.data.items() if k in allowed}
                if not data:
                    raise PermissionDenied('Seuls les messages email sont modifiables.')
            elif is_reservations_agent(request.user, hotel):
                data = {k: v for k, v in request.data.items() if k in reservation_email_keys}
                if not data:
                    raise PermissionDenied('Seuls les messages email de réservation sont modifiables.')
            elif is_front_desk(request.user, hotel):
                data = {k: v for k, v in request.data.items() if k in front_desk_email_keys}
                if not data:
                    raise PermissionDenied('Seuls les messages email check-in / check-out sont modifiables.')
            else:
                raise PermissionDenied()
            ser = self.get_serializer(profile, data=data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            audit(hotel, request.user, 'UPDATE_PROFILE', 'HotelProfile', profile.id, new=ser.data)
            return Response(ser.data)
        return Response(self.get_serializer(profile).data)

    @action(detail=False, methods=['post'], url_path='seed-roles')
    def seed_roles(self, request):
        """Crée les rôles PMS pré-définis manquants (Manager, Réception, HK, Caisse…)."""
        hotel = _hotel(request)
        if not can_access_hotel_roles(request.user, hotel, 'create'):
            raise PermissionDenied('Permission hotel.roles requise.')
        created, roles = seed_hotel_default_roles(hotel)
        from businesses.serializers import BusinessRoleSerializer
        return Response({
            'created_count': created,
            'roles': BusinessRoleSerializer(roles, many=True).data,
            'message': f'{created} rôle(s) créé(s).' if created else 'Tous les rôles pré-définis sont déjà présents.',
        })


class HotelDepartmentViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = HotelDepartment.objects.all()
    serializer_class = HotelDepartmentSerializer

    def get_permissions(self):
        if self.request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return [IsAuthenticated(), IsHotelAdmin()]
        return super().get_permissions()


class RoomTypeViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = RoomType.objects.all()
    serializer_class = RoomTypeSerializer
    hotel_perm_resource = 'room_types'

    def get_queryset(self):
        return super().get_queryset().annotate(rooms_count=Count('rooms'))

    def get_permissions(self):
        return [IsAuthenticated(), HotelCrudPermission()]

    def destroy(self, request, *args, **kwargs):
        """
        Suppression physique si aucune chambre liée ;
        sinon désactivation (Room.room_type est PROTECT).
        """
        instance = self.get_object()
        hotel = self.get_hotel()
        if instance.rooms.exists():
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            audit(hotel, request.user, 'ROOM_TYPE_DEACTIVATE', 'RoomType', instance.id)
            return Response({
                'soft_deleted': True,
                'id': str(instance.id),
                'name': instance.name,
                'is_active': instance.is_active,
                'detail': (
                    f'Le type « {instance.name} » est lié à des chambres : '
                    'il a été désactivé au lieu d\'être supprimé.'
                ),
            })
        audit(hotel, request.user, 'ROOM_TYPE_DELETE', 'RoomType', instance.id)
        return super().destroy(request, *args, **kwargs)


class RoomViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = Room.objects.select_related('room_type')
    serializer_class = RoomSerializer
    hotel_perm_resource = 'rooms'
    hotel_perm_actions = {'mark_ready': 'update'}

    def get_permissions(self):
        # mark-ready : gouvernante / HK (pas seulement admin)
        if getattr(self, 'action', None) == 'mark_ready':
            return [IsAuthenticated(), IsHousekeepingStaff()]
        return [IsAuthenticated(), HotelCrudPermission()]

    def destroy(self, request, *args, **kwargs):
        """
        Suppression physique si aucun séjour lié ;
        sinon désactivation (Stay.room est PROTECT).
        """
        instance = self.get_object()
        hotel = self.get_hotel()
        if instance.stays.exists():
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            audit(hotel, request.user, 'ROOM_DEACTIVATE', 'Room', instance.id)
            return Response({
                'soft_deleted': True,
                'id': str(instance.id),
                'number': instance.number,
                'is_active': instance.is_active,
                'detail': (
                    f'La chambre {instance.number} est liée à des séjours : '
                    'elle a été désactivée au lieu d\'être supprimée.'
                ),
            })
        audit(hotel, request.user, 'ROOM_DELETE', 'Room', instance.id)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='mark-ready')
    def mark_ready(self, request, pk=None):
        """Gouvernante / manager : chambre prête → de nouveau revendable (check-in)."""
        hotel = self.get_hotel()
        if not (is_housekeeping_lead(request.user, hotel) or is_hotel_admin(request.user, hotel)):
            raise PermissionDenied('Seule la gouvernante (ou un manager) peut valider une chambre Prête.')
        room = self.get_object()
        room.housekeeping_status = 'READY'
        if room.operational_status not in ('MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE', 'OCCUPIED'):
            room.operational_status = 'AVAILABLE'
        room.save(update_fields=['housekeeping_status', 'operational_status'])
        audit(hotel, request.user, 'ROOM_READY', 'Room', room.id)
        return Response(RoomSerializer(room).data)


class RatePlanViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = RatePlan.objects.select_related('room_type')
    serializer_class = RatePlanSerializer
    hotel_perm_resource = 'rates'

    def get_permissions(self):
        return [IsAuthenticated(), HotelCrudPermission()]


class GuestViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = Guest.objects.all()
    serializer_class = GuestSerializer
    hotel_perm_resource = 'guests'

    def get_permissions(self):
        return [IsAuthenticated(), HotelCrudPermission()]

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q)
                | Q(phone__icontains=q) | Q(email__icontains=q)
            )
        return qs


class ReservationViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = Reservation.objects.select_related('guest', 'room', 'room_type', 'rate_plan')
    serializer_class = ReservationSerializer
    hotel_perm_resource = 'reservations'
    hotel_perm_actions = {
        'confirm': 'confirm',
        'cancel': 'cancel',
        'refund': 'cancel',
        'mark_no_show': 'cancel',
        'pay': 'update',
        'confirm_payment': 'update',
        'mark_paid': 'update',
        'respond_reschedule': 'confirm',
        'reply': 'reply',
    }

    def get_queryset(self):
        from .client_messages import client_message_pending, has_client_message

        qs = super().get_queryset()
        status_f = self.request.query_params.get('status')
        date_f = self.request.query_params.get('date')
        client_msg = (self.request.query_params.get('client_messages') or '').strip().lower()
        reschedule_f = (self.request.query_params.get('reschedule') or '').strip().lower()
        if status_f:
            qs = qs.filter(status=status_f)
        if date_f:
            qs = qs.filter(check_in_date=date_f)
        if reschedule_f in ('pending', '1', 'true', 'yes'):
            qs = qs.filter(reschedule_status='PENDING')
        elif reschedule_f in ('accepted', 'refused', 'none'):
            qs = qs.filter(reschedule_status=reschedule_f.upper())
        if client_msg in ('1', 'true', 'yes', 'pending', 'all'):
            # Filtre texte → raffiné en Python (volume hôtel MVP)
            candidates = list(
                qs.exclude(special_requests='')
                .exclude(special_requests__isnull=True)
                .exclude(status__in=('CANCELLED', 'EXPIRED', 'NO_SHOW'))
            )
            if client_msg == 'all':
                ids = [r.id for r in candidates if has_client_message(r.special_requests or '')]
            else:
                ids = [r.id for r in candidates if client_message_pending(r.special_requests or '')]
            qs = qs.filter(id__in=ids)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['hotel'] = self.get_hotel()
        return ctx

    def get_permissions(self):
        if self.action in ('check_in', 'walk_in'):
            return [IsAuthenticated(), IsFrontDeskOrAdmin()]
        return [IsAuthenticated(), HotelCrudPermission()]

    def perform_create(self, serializer):
        reservation = serializer.save()
        from .reservation_notifications import notify_reservation_requested
        # Email client si adresse connue (création staff ou liée à un guest)
        notify_reservation_requested(reservation)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        res = self.get_object()
        if res.status in ('CANCELLED', 'CHECKED_OUT', 'CHECKED_IN'):
            raise ValidationError({'status': 'Impossible de confirmer.'})
        from .reservation_payment import ensure_payment_settled_for_confirm
        from .reservation_notifications import notify_reservation_confirmed

        settle = ensure_payment_settled_for_confirm(res, allow_stub_simulate=False)
        res.refresh_from_db()
        if not settle.get('ok'):
            raise ValidationError({'payment_status': settle.get('message') or 'Paiement requis.'})

        res.status = 'CONFIRMED'
        note = (
            request.data.get('note')
            or request.data.get('message')
            or request.data.get('decision_note')
            or 'Votre réservation a été confirmée par l’hôtel.'
        )
        note = str(note).strip()[:2000]
        res.decision_note = note
        res.decision_at = timezone.now()
        from .client_messages import append_hotel_history_line
        actor = (
            (request.user.first_name or '')
            or (getattr(request.user, 'email', None) or '')
            or 'Hôtel'
        ).strip()
        append_hotel_history_line(res, f'Confirmation : {note}', author=actor)
        res.save(update_fields=['status', 'decision_note', 'decision_at', 'special_requests', 'updated_at'])
        audit(res.hotel, request.user, 'CONFIRM', 'Reservation', res.id)
        email_result = notify_reservation_confirmed(res)
        data = ReservationSerializer(res, context=self.get_serializer_context()).data
        return Response({
            **data,
            'payment_simulated': bool(settle.get('simulated')),
            'email_notification': email_result,
        })

    @action(detail=True, methods=['post'], url_path='no-show')
    def mark_no_show(self, request, pk=None):
        """Client non présenté — libère la chambre (après remboursement si PAID)."""
        from .services import mark_reservation_no_show
        res = self.get_object()
        note = (
            request.data.get('note')
            or request.data.get('reason')
            or request.data.get('decision_note')
            or ''
        )
        note = str(note).strip()
        updated = mark_reservation_no_show(res, actor=request.user, note=note)
        return Response(ReservationSerializer(updated, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        res = self.get_object()
        if res.status == 'CHECKED_IN':
            raise ValidationError({'status': 'Check-out requis avant annulation.'})
        from .reservation_payment import ensure_refunded_before_cancel
        from .reservation_notifications import notify_reservation_rejected

        refund_gate = ensure_refunded_before_cancel(res)
        if not refund_gate.get('ok'):
            raise ValidationError({
                'payment_status': refund_gate.get('message') or 'Remboursement requis avant refus.',
                'code': refund_gate.get('code') or 'REFUND_REQUIRED',
            })

        previous = res.status
        reason = (
            request.data.get('reason')
            or request.data.get('comment')
            or request.data.get('note')
            or request.data.get('decision_note')
            or ''
        )
        reason = str(reason).strip()
        # Refus d'une demande en attente : motif obligatoire (visible client + email)
        if previous in ('PENDING', 'DRAFT'):
            if len(reason) < 3:
                raise ValidationError({
                    'reason': 'Motif du refus obligatoire (au moins 3 caractères).',
                })
        res.status = 'CANCELLED'
        from .client_messages import append_hotel_history_line
        actor = (
            (request.user.first_name or '')
            or (getattr(request.user, 'email', None) or '')
            or 'Hôtel'
        ).strip()
        if previous in ('PENDING', 'DRAFT'):
            res.decision_note = reason[:2000]
            res.decision_at = timezone.now()
            append_hotel_history_line(res, f'Refus : {reason}', author=actor)
            res.save(update_fields=['status', 'decision_note', 'decision_at', 'special_requests', 'updated_at'])
        else:
            if reason:
                res.decision_note = reason[:2000]
                res.decision_at = timezone.now()
                append_hotel_history_line(res, f'Annulation : {reason}', author=actor)
                res.save(update_fields=['status', 'decision_note', 'decision_at', 'special_requests', 'updated_at'])
            else:
                res.save(update_fields=['status', 'updated_at'])
        if res.room and res.room.operational_status == 'RESERVED':
            res.room.operational_status = 'AVAILABLE'
            res.room.save(update_fields=['operational_status'])
        audit(
            res.hotel, request.user, 'CANCEL', 'Reservation', res.id,
            old={'status': previous}, new={'reason': reason},
        )
        email_result = None
        # Email de refus uniquement pour une demande encore en attente
        if previous in ('PENDING', 'DRAFT'):
            email_result = notify_reservation_rejected(res, reason=reason)
        data = ReservationSerializer(res, context=self.get_serializer_context()).data
        return Response({**data, 'email_notification': email_result})

    @action(detail=True, methods=['post'], url_path='respond-reschedule')
    def respond_reschedule(self, request, pk=None):
        """Agent réservations : accepter ou refuser une demande d'anticipation / report."""
        from .reservation_notifications import notify_reschedule_response
        from .services import compute_total, available_rooms

        res = self.get_object()
        if res.reschedule_status != 'PENDING':
            raise ValidationError({'reschedule_status': 'Aucune demande en attente.'})

        decision = (request.data.get('decision') or request.data.get('action') or '').strip().lower()
        note = (request.data.get('note') or request.data.get('admin_note') or '').strip()
        accept = decision in ('accept', 'accepted', 'approve', 'ok', 'yes', '1', 'true')

        if accept:
            new_in = request.data.get('check_in_date') or res.reschedule_preferred_check_in
            new_out = request.data.get('check_out_date') or res.reschedule_preferred_check_out
            if isinstance(new_in, str):
                new_in = date.fromisoformat(new_in)
            if isinstance(new_out, str):
                new_out = date.fromisoformat(new_out)
            if not new_in or not new_out or new_out <= new_in:
                raise ValidationError({'dates': 'Dates invalides pour accepter le déplacement.'})
            free = available_rooms(
                res.hotel, res.room_type_id, new_in, new_out,
                exclude_reservation_id=res.id,
            )
            if not free:
                raise ValidationError({
                    'availability': 'Aucune disponibilité sur les nouvelles dates.',
                })
            old_in, old_out = res.check_in_date, res.check_out_date
            res.check_in_date = new_in
            res.check_out_date = new_out
            total, _ = compute_total(res.amount_per_night, new_in, new_out)
            res.total_amount = total
            if res.room_id:
                # Libérer l'attribution si dates changent — réception ré-assignera
                res.room = None
            res.reschedule_status = 'ACCEPTED'
            res.reschedule_admin_note = note[:2000]
            res.reschedule_resolved_at = timezone.now()
            res.save(update_fields=[
                'check_in_date', 'check_out_date', 'total_amount', 'room',
                'reschedule_status', 'reschedule_admin_note', 'reschedule_resolved_at', 'updated_at',
            ])
            audit(
                res.hotel, request.user, 'RESCHEDULE_ACCEPT', 'Reservation', res.id,
                old={'check_in': str(old_in), 'check_out': str(old_out)},
                new={'check_in': str(new_in), 'check_out': str(new_out), 'note': note},
            )
            email_result = notify_reschedule_response(res, accepted=True, note=note)
        else:
            if len(note) < 3:
                raise ValidationError({
                    'note': 'Motif du refus obligatoire (au moins 3 caractères).',
                })
            res.reschedule_status = 'REFUSED'
            res.reschedule_admin_note = note[:2000]
            res.reschedule_resolved_at = timezone.now()
            res.save(update_fields=[
                'reschedule_status', 'reschedule_admin_note', 'reschedule_resolved_at', 'updated_at',
            ])
            audit(res.hotel, request.user, 'RESCHEDULE_REFUSE', 'Reservation', res.id, new={'note': note})
            email_result = notify_reschedule_response(res, accepted=False, note=note)

        data = ReservationSerializer(res, context=self.get_serializer_context()).data
        return Response({**data, 'email_notification': email_result})

    @action(detail=True, methods=['post'], url_path='reply')
    def reply(self, request, pk=None):
        """
        Réponse hôtel → client (visible dans special_requests / historique client).
        Permission : hotel.reservations.reply (attribuable aux rôles).
        """
        from .reservation_notifications import notify_hotel_reply

        res = self.get_object()
        if res.status in ('CANCELLED', 'EXPIRED', 'NO_SHOW'):
            raise ValidationError({
                'status': 'Impossible de répondre sur une réservation clôturée définitivement.',
            })

        message = (request.data.get('message') or request.data.get('note') or '').strip()
        if not message:
            raise ValidationError({'message': 'Message requis.'})
        if len(message) > 2000:
            raise ValidationError({'message': 'Message trop long (max. 2000 caractères).'})

        stamp = timezone.now().strftime('%Y-%m-%d %H:%M')
        author = (
            (request.user.first_name or '')
            or (getattr(request.user, 'email', None) or '')
            or 'Hôtel'
        ).strip()
        hotel_label = (res.hotel.name or 'Hôtel').strip()
        line = f'[{stamp} — {hotel_label} · {author}] {message}'
        prev = (res.special_requests or '').strip()
        res.special_requests = f'{prev}\n{line}'.strip() if prev else line
        res.save(update_fields=['special_requests', 'updated_at'])
        audit(
            res.hotel, request.user, 'HOTEL_REPLY', 'Reservation', res.id,
            new={'message': message[:200]},
        )
        email_result = notify_hotel_reply(res, message)
        data = ReservationSerializer(res, context=self.get_serializer_context()).data
        return Response({
            **data,
            'message': 'Réponse envoyée au client.',
            'email_notification': email_result,
        })

    @action(detail=True, methods=['post'], url_path='refund')
    def refund(self, request, pk=None):
        """Marque le paiement comme remboursé (obligatoire avant refus si PAID)."""
        from .reservation_payment import refund_reservation_payment
        res = self.get_object()
        if res.status in ('CHECKED_IN', 'CHECKED_OUT'):
            raise ValidationError({'status': 'Remboursement réservation indisponible après check-in.'})
        result = refund_reservation_payment(
            res,
            note=request.data.get('note') or request.data.get('reason') or '',
            actor=request.user,
        )
        if not result.get('ok'):
            raise ValidationError({'payment_status': result.get('message') or 'Remboursement impossible.'})
        audit(res.hotel, request.user, 'REFUND', 'Reservation', res.id, new={
            'payment_status': res.payment_status,
            'note': res.payment_note,
        })
        return Response({
            **ReservationSerializer(res, context=self.get_serializer_context()).data,
            'message': result.get('message'),
        })

    @action(detail=True, methods=['post'], url_path='pay')
    def pay(self, request, pk=None):
        from .reservation_payment import initiate_reservation_payment
        from businesses import burundipay as burundipay_client

        res = self.get_object()
        payer_phone = (request.data.get('payer_phone') or request.data.get('phone') or '').strip()
        if not payer_phone:
            # En simulation, un numéro placeholder suffit pour relancer
            from businesses import burundipay
            if burundipay.is_stub_mode():
                payer_phone = (res.payer_phone or '').strip() or '79556677'
            else:
                return Response(
                    {'error': 'payer_phone (BurundiPay) requis.', 'detail': 'payer_phone (BurundiPay) requis.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        result = initiate_reservation_payment(res, payer_phone)
        res.refresh_from_db()
        data = ReservationSerializer(res, context=self.get_serializer_context()).data
        return Response({
            'ok': result.get('ok'),
            'already_paid': result.get('already_paid', False),
            'message': result.get('message') or '',
            'detail': result.get('message') or '',
            'stub_mode': result.get('stub_mode', burundipay_client.is_stub_mode()),
            'amount_bif': result.get('amount_bif'),
            'currency': result.get('currency', res.currency),
            'merchant_account': result.get('merchant_account') or res.payment_merchant_account,
            'provider_reference': result.get('provider_reference') or res.payment_provider_reference,
            'reservation': data,
        }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        from .reservation_payment import confirm_reservation_payment_stub

        res = self.get_object()
        result = confirm_reservation_payment_stub(res)
        res.refresh_from_db()
        data = ReservationSerializer(res, context=self.get_serializer_context()).data
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message') or '',
            'reservation': data,
        }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        from .reservation_payment import mark_reservation_paid_by_staff

        hotel = self.get_hotel()
        if not (is_front_desk(request.user, hotel) or is_hotel_admin(request.user, hotel)
                or is_reservations_agent(request.user, hotel)):
            raise PermissionDenied('Permission refusée.')
        res = self.get_object()
        waive = request.data.get('waive') in (True, 'true', '1', 1)
        if waive:
            res.payment_status = 'WAIVED'
            res.paid_at = timezone.now()
            res.payment_method = 'WAIVED'
            res.payment_note = (request.data.get('note') or 'Exonéré par le personnel')[:255]
            res.save(update_fields=[
                'payment_status', 'paid_at', 'payment_method', 'payment_note', 'updated_at',
            ])
            result = {'ok': True, 'message': 'Réservation exonérée.', 'reservation': res}
        else:
            result = mark_reservation_paid_by_staff(
                res,
                method=(request.data.get('method') or 'CASH'),
                note=(request.data.get('note') or ''),
                actor=request.user,
            )
        res.refresh_from_db()
        audit(hotel, request.user, 'MARK_PAID', 'Reservation', res.id)
        return Response({
            'ok': True,
            'message': result.get('message'),
            'reservation': ReservationSerializer(res, context=self.get_serializer_context()).data,
        })

    @action(detail=True, methods=['post'], url_path='check-in')
    def check_in(self, request, pk=None):
        hotel = self.get_hotel()
        if not (is_front_desk(request.user, hotel) or is_hotel_admin(request.user, hotel)):
            raise PermissionDenied('Check-in réservé à la réception.')
        res = self.get_object()
        room_id = request.data.get('room_id') or (str(res.room_id) if res.room_id else None)
        if not room_id:
            raise ValidationError({'room_id': 'Chambre requise.'})
        room = Room.objects.filter(hotel=res.hotel, id=room_id).first()
        if not room:
            raise ValidationError({'room_id': 'Chambre introuvable.'})
        stay = check_in_reservation(res, room, request.user)
        from .reservation_notifications import notify_check_in
        email_result = notify_check_in(res, stay=stay)
        data = StaySerializer(stay).data
        return Response({**data, 'email_notification': email_result}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='walk-in')
    def walk_in(self, request):
        """Check-in sans réservation préalable."""
        hotel = self.get_hotel()
        if not (is_front_desk(request.user, hotel) or is_hotel_admin(request.user, hotel)):
            raise PermissionDenied()
        data = request.data
        room = Room.objects.filter(hotel=hotel, id=data.get('room_id')).first()
        if not room:
            raise ValidationError({'room_id': 'Chambre requise.'})
        guest = Guest.objects.create(
            hotel=hotel,
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            phone=data.get('phone', ''),
            email=data.get('email', ''),
        )
        check_in_d = data.get('check_in_date') or date.today().isoformat()
        check_out_d = data.get('check_out_date')
        if not check_out_d:
            raise ValidationError({'check_out_date': 'Date de départ requise.'})
        if isinstance(check_in_d, str):
            check_in_d = date.fromisoformat(check_in_d)
        if isinstance(check_out_d, str):
            check_out_d = date.fromisoformat(check_out_d)
        adults = int(data.get('adults') or 1)
        children = int(data.get('children') or 0)
        rt = room.room_type
        if adults > (rt.capacity_adults or 0):
            raise ValidationError({'adults': f'Maximum {rt.capacity_adults} adulte(s).'})
        if children > (rt.capacity_children or 0):
            raise ValidationError({'children': f'Maximum {rt.capacity_children} enfant(s).'})

        rate = RatePlan.objects.filter(
            hotel=hotel, room_type=rt, is_active=True,
        ).order_by('price_per_night').first()
        if not rate:
            rate, _meta = resolve_rate_plan(hotel, rt, auto_create=True, notify=True)
        if not rate:
            raise ValidationError({
                'rate_plan': (
                    'Ce type de chambre n’est pas encore disponible à la réservation. '
                    'Veuillez choisir un autre type ou réessayer plus tard.'
                ),
            })
        amount = rate.price_per_night
        from .services import compute_total, next_reference
        total, _ = compute_total(amount, check_in_d, check_out_d)
        res = Reservation.objects.create(
            reference=next_reference(hotel, 'RES'),
            hotel=hotel,
            guest=guest,
            room_type=rt,
            room=room,
            rate_plan=rate,
            check_in_date=check_in_d,
            check_out_date=check_out_d,
            adults=adults,
            children=children,
            status='CONFIRMED',
            source='WALK_IN',
            amount_per_night=amount,
            total_amount=total,
            currency=rate.currency or 'BIF',
            created_by=request.user,
        )
        stay = check_in_reservation(res, room, request.user, walk_in=True)
        from .reservation_notifications import notify_check_in
        email_result = notify_check_in(res, stay=stay)
        data = StaySerializer(stay).data
        return Response({**data, 'email_notification': email_result}, status=status.HTTP_201_CREATED)


class StayViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = Stay.objects.select_related('guest', 'room', 'reservation', 'folio')
    serializer_class = StaySerializer
    http_method_names = ['get', 'patch', 'post', 'head', 'options']
    permission_classes = [IsAuthenticated, IsFrontDeskOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        st = self.request.query_params.get('status')
        if st:
            qs = qs.filter(status=st)
        return qs

    @action(detail=True, methods=['post'], url_path='add-service')
    def add_service(self, request, pk=None):
        stay = self.get_object()
        svc = HotelService.objects.filter(hotel=stay.hotel, id=request.data.get('service_id'), is_active=True).first()
        if not svc:
            raise ValidationError({'service_id': 'Service invalide.'})
        folio = add_service_to_stay(stay, svc, request.data.get('quantity', 1), request.user)
        return Response(FolioSerializer(folio).data)

    @action(detail=True, methods=['post'], url_path='change-room')
    def change_room(self, request, pk=None):
        stay = self.get_object()
        if stay.status != 'IN_HOUSE':
            raise ValidationError({'status': 'Séjour inactif.'})
        new_room = Room.objects.filter(hotel=stay.hotel, id=request.data.get('room_id')).first()
        if not new_room:
            raise ValidationError({'room_id': 'Chambre invalide.'})
        assert_room_assignable(
            new_room,
            stay.reservation.check_in_date,
            stay.reservation.check_out_date,
            stay.reservation_id,
        )
        old = stay.room
        old.operational_status = 'CLEANING'
        old.housekeeping_status = 'CLEANING_REQUIRED'
        old.save(update_fields=['operational_status', 'housekeeping_status'])
        hk_task = HousekeepingTask.objects.create(
            hotel=stay.hotel, room=old, task_type='CLEANING', priority='NORMAL', status='PENDING',
            comment=f'Après changement de chambre (séjour {stay.id})',
        )
        from .housekeeping_notifications import notify_cleaning_required
        notify_cleaning_required(
            stay.hotel, old, task=hk_task, stay=stay, reason='room_change',
        )
        new_room.operational_status = 'OCCUPIED'
        new_room.housekeeping_status = 'OCCUPIED'
        new_room.save(update_fields=['operational_status', 'housekeeping_status'])
        stay.previous_room = old
        stay.room = new_room
        stay.save(update_fields=['previous_room', 'room'])
        stay.reservation.room = new_room
        stay.reservation.save(update_fields=['room', 'updated_at'])
        audit(stay.hotel, request.user, 'CHANGE_ROOM', 'Stay', stay.id, old={'room': old.number}, new={'room': new_room.number})
        return Response(StaySerializer(stay).data)

    @action(detail=True, methods=['post'], url_path='check-out')
    def check_out(self, request, pk=None):
        stay = self.get_object()
        hotel = stay.hotel
        allow = bool(request.data.get('allow_balance')) and is_hotel_admin(request.user, hotel)
        inv = check_out_stay(stay, request.user, allow_balance=allow)
        stay.refresh_from_db()
        from .reservation_notifications import notify_check_out
        email_result = notify_check_out(stay.reservation, stay=stay, invoice=inv)
        hk_notification = getattr(inv, '_hk_notification', None) or {}
        data = HotelInvoiceSerializer(inv).data
        return Response({
            **data,
            'email_notification': email_result,
            'housekeeping_notification': hk_notification,
        })


class HotelServiceViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = HotelService.objects.all()
    serializer_class = HotelServiceSerializer
    hotel_perm_resource = 'services'

    def get_permissions(self):
        return [IsAuthenticated(), HotelCrudPermission()]


class FolioViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FolioSerializer
    permission_classes = [IsAuthenticated, IsCashierOrAdmin]

    def get_queryset(self):
        hotel = _hotel(self.request)
        qs = (
            Folio.objects.filter(stay__hotel=hotel)
            .select_related(
                'guest', 'stay', 'stay__room', 'stay__reservation', 'stay__guest',
            )
            .prefetch_related('items', 'payments')
            .order_by('-updated_at')
        )
        status_f = (self.request.query_params.get('status') or '').strip().upper()
        if status_f:
            qs = qs.filter(status=status_f)
        unpaid = (self.request.query_params.get('unpaid') or '').strip().lower()
        if unpaid in ('1', 'true', 'yes'):
            qs = qs.filter(status='OPEN', balance__gt=0)
        return qs

    @action(detail=True, methods=['post'], url_path='pay-burundipay')
    def pay_burundipay(self, request, pk=None):
        from .folio_payment import initiate_folio_burundipay
        folio = self.get_object()
        result = initiate_folio_burundipay(
            folio,
            request.data.get('amount'),
            request.data.get('payer_phone') or request.data.get('phone') or '',
            request.user,
        )
        payment = result['payment']
        folio.refresh_from_db()
        return Response({
            'ok': result['ok'],
            'message': result['message'],
            'stub_mode': result.get('stub_mode'),
            'provider_reference': result.get('provider_reference'),
            'merchant_account': result.get('merchant_account'),
            'amount': result.get('amount'),
            'currency': result.get('currency'),
            'payer_phone': result.get('payer_phone'),
            'payment': PaymentSerializer(payment).data,
            'folio': FolioSerializer(folio).data,
        }, status=status.HTTP_200_OK if result['ok'] else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='confirm-burundipay')
    def confirm_burundipay(self, request, pk=None):
        from .folio_payment import confirm_folio_burundipay_stub
        folio = self.get_object()
        payment_id = request.data.get('payment_id') or request.data.get('payment')
        payment = None
        if payment_id:
            payment = folio.payments.filter(id=payment_id).first()
        if not payment:
            payment = folio.payments.filter(
                method='BURUNDIPAY', status__in=('AWAITING_PIN', 'PENDING', 'FAILED'),
            ).order_by('-paid_at').first()
        if not payment:
            raise ValidationError({'payment': 'Aucun paiement BurundiPay en attente.'})
        result = confirm_folio_burundipay_stub(payment, request.user)
        payment.refresh_from_db()
        folio.refresh_from_db()
        return Response({
            'ok': result['ok'],
            'message': result.get('message') or '',
            'stub_mode': result.get('stub_mode'),
            'payment': PaymentSerializer(payment).data,
            'folio': FolioSerializer(folio).data,
        }, status=status.HTTP_200_OK if result['ok'] else status.HTTP_400_BAD_REQUEST)


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsCashierOrAdmin]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        hotel = _hotel(self.request)
        qs = (
            Payment.objects.filter(folio__stay__hotel=hotel)
            .select_related(
                'folio', 'folio__guest', 'folio__stay', 'folio__stay__room',
                'folio__stay__reservation',
            )
            .order_by('-paid_at')
        )
        day = (self.request.query_params.get('date') or '').strip()
        if day:
            qs = qs.filter(paid_at__date=date.fromisoformat(day))
        today_only = (self.request.query_params.get('today') or '').strip().lower()
        if today_only in ('1', 'true', 'yes'):
            qs = qs.filter(paid_at__date=date.today())
        return qs

    def create(self, request, *args, **kwargs):
        folio = Folio.objects.filter(id=request.data.get('folio'), stay__hotel=_hotel(request)).first()
        if not folio:
            raise ValidationError({'folio': 'Folio introuvable.'})
        method = (request.data.get('method') or 'CASH').upper()
        if method == 'BURUNDIPAY':
            raise ValidationError({
                'method': 'Utilisez l’action pay-burundipay du folio pour BurundiPay.',
            })
        payment = record_payment(
            folio,
            request.data.get('amount'),
            method,
            request.user,
            request.data.get('reference', ''),
            request.data.get('notes', ''),
        )
        data = PaymentSerializer(payment).data
        from .receipts import build_payment_receipt
        return Response({
            **data,
            'receipt': build_payment_receipt(payment),
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        from .receipts import build_payment_receipt
        payment = self.get_object()
        if payment.status != 'PAID':
            raise ValidationError({'status': 'Reçu disponible uniquement pour un paiement confirmé.'})
        return Response(build_payment_receipt(payment))


class HotelInvoiceViewSet(TenantHotelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = HotelInvoice.objects.all()
    serializer_class = HotelInvoiceSerializer
    permission_classes = [IsAuthenticated, IsCashierOrAdmin]


class HousekeepingTaskViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = HousekeepingTask.objects.select_related('room', 'assigned_to')
    serializer_class = HousekeepingTaskSerializer

    def get_permissions(self):
        return [IsAuthenticated(), IsHousekeepingStaff()]

    def get_queryset(self):
        qs = super().get_queryset()
        hotel = self.get_hotel()
        status_f = self.request.query_params.get('status')
        if status_f:
            qs = qs.filter(status=status_f)
        # Agent ménage : ses tâches uniquement (sauf lead/admin)
        if is_housekeeping(self.request.user, hotel) and not is_housekeeping_lead(self.request.user, hotel):
            qs = qs.filter(Q(assigned_to=self.request.user) | Q(assigned_to__isnull=True))
            if self.request.query_params.get('mine') == '1':
                qs = qs.filter(assigned_to=self.request.user)
        elif self.request.query_params.get('mine') == '1':
            qs = qs.filter(assigned_to=self.request.user)
        return qs

    def perform_create(self, serializer):
        hotel = self.get_hotel()
        if not is_housekeeping_lead(self.request.user, hotel):
            raise PermissionDenied('Seule la gouvernante peut créer / assigner des tâches.')
        serializer.save(hotel=hotel)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        hotel = self.get_hotel()
        if not is_housekeeping_lead(request.user, hotel):
            raise PermissionDenied()
        task = self.get_object()
        user_id = request.data.get('assigned_to')
        if not user_id:
            raise ValidationError({'assigned_to': 'Agent requis.'})
        from django.contrib.auth import get_user_model
        User = get_user_model()
        agent = User.objects.filter(id=user_id).first()
        if not agent:
            raise ValidationError({'assigned_to': 'Utilisateur introuvable.'})
        task.assigned_to = agent
        task.status = 'ASSIGNED'
        task.save(update_fields=['assigned_to', 'status'])
        audit(hotel, request.user, 'HK_ASSIGN', 'HousekeepingTask', task.id, new={'agent': agent.email})
        return Response(HousekeepingTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        task = self.get_object()
        task.status = 'IN_PROGRESS'
        task.started_at = timezone.now()
        if not task.assigned_to_id:
            task.assigned_to = request.user
        task.save(update_fields=['status', 'started_at', 'assigned_to'])
        room = task.room
        room.operational_status = 'CLEANING'
        room.housekeeping_status = 'CLEANING_REQUIRED'
        room.save(update_fields=['operational_status', 'housekeeping_status'])
        return Response(HousekeepingTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        hotel = self.get_hotel()
        task.status = 'DONE'
        task.completed_at = timezone.now()
        task.comment = request.data.get('comment', task.comment)
        task.save(update_fields=['status', 'completed_at', 'comment'])
        room = task.room
        # Agent : inspection ; lead peut marquer Prête directement
        mark_ready = request.data.get('mark_ready')
        if mark_ready is None:
            mark_ready = is_housekeeping_lead(request.user, hotel)
        if mark_ready:
            room.housekeeping_status = 'READY'
            if room.operational_status not in ('MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE', 'OCCUPIED'):
                room.operational_status = 'AVAILABLE'
            room.save(update_fields=['housekeeping_status', 'operational_status'])
        else:
            # En attente validation gouvernante — pas encore revendable
            room.housekeeping_status = 'INSPECTION'
            if room.operational_status not in ('MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE', 'OCCUPIED'):
                room.operational_status = 'CLEANING'
            room.save(update_fields=['housekeeping_status', 'operational_status'])
        audit(task.hotel, request.user, 'HK_DONE', 'HousekeepingTask', task.id)
        return Response(HousekeepingTaskSerializer(task).data)

    @action(detail=True, methods=['post'], url_path='report-issue')
    def report_issue(self, request, pk=None):
        task = self.get_object()
        desc = (request.data.get('description') or '').strip()
        if not desc:
            raise ValidationError({'description': 'Description requise.'})
        ticket = MaintenanceTicket.objects.create(
            hotel=task.hotel,
            room=task.room,
            category='HOUSEKEEPING',
            description=desc,
            priority=request.data.get('priority') or 'NORMAL',
            blocks_room=bool(request.data.get('blocks_room', False)),
            opened_by=request.user,
        )
        if ticket.blocks_room:
            room = task.room
            room.operational_status = 'MAINTENANCE'
            room.save(update_fields=['operational_status'])
        audit(task.hotel, request.user, 'HK_ISSUE', 'MaintenanceTicket', ticket.id)
        return Response(MaintenanceTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class MaintenanceTicketViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = MaintenanceTicket.objects.select_related('room')
    serializer_class = MaintenanceTicketSerializer

    def get_permissions(self):
        return [IsAuthenticated(), IsMaintenanceOrAdmin()]

    def perform_create(self, serializer):
        hotel = self.get_hotel()
        ticket = serializer.save(hotel=hotel, opened_by=self.request.user)
        if ticket.blocks_room and ticket.room_id:
            room = ticket.room
            room.operational_status = 'MAINTENANCE'
            room.maintenance_status = 'OPEN'
            room.save(update_fields=['operational_status', 'maintenance_status'])
        audit(hotel, self.request.user, 'MAINT_OPEN', 'MaintenanceTicket', ticket.id)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = 'RESOLVED'
        ticket.resolved_at = timezone.now()
        ticket.comment = request.data.get('comment', ticket.comment)
        ticket.save(update_fields=['status', 'resolved_at', 'comment'])
        if ticket.room_id and ticket.blocks_room:
            room = ticket.room
            open_others = MaintenanceTicket.objects.filter(
                room=room, blocks_room=True, status__in=('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING')
            ).exclude(pk=ticket.pk).exists()
            if not open_others:
                room.operational_status = 'AVAILABLE'
                room.maintenance_status = ''
                room.housekeeping_status = 'CLEANING_REQUIRED'
                room.save(update_fields=['operational_status', 'maintenance_status', 'housekeeping_status'])
                hk_task = HousekeepingTask.objects.create(
                    hotel=ticket.hotel, room=room, task_type='CLEANING', priority='NORMAL',
                    status='PENDING',
                    comment='Après maintenance',
                )
                from .housekeeping_notifications import notify_cleaning_required
                notify_cleaning_required(
                    ticket.hotel, room, task=hk_task, stay=None, reason='after_maintenance',
                )
        audit(ticket.hotel, request.user, 'MAINT_RESOLVE', 'MaintenanceTicket', ticket.id)
        return Response(MaintenanceTicketSerializer(ticket).data)


class HotelAuditLogViewSet(TenantHotelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = HotelAuditLog.objects.select_related('actor')
    serializer_class = HotelAuditLogSerializer
    permission_classes = [IsAuthenticated, IsHotelAdmin]


class CashClosingViewSet(TenantHotelMixin, viewsets.ModelViewSet):
    queryset = CashClosing.objects.all()
    serializer_class = CashClosingSerializer
    permission_classes = [IsAuthenticated, IsCashierOrAdmin]
    http_method_names = ['get', 'post', 'head', 'options']

    def create(self, request, *args, **kwargs):
        hotel = self.get_hotel()
        period = request.data.get('period_date') or date.today().isoformat()
        if isinstance(period, str):
            period = date.fromisoformat(period)
        if CashClosing.objects.filter(hotel=hotel, period_date=period).exists():
            raise ValidationError({'period_date': 'Journée déjà clôturée.'})
        qs = Payment.objects.filter(
            folio__stay__hotel=hotel,
            status='PAID',
            paid_at__date=period,
        )
        total = qs.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        by_method = list(
            qs.values('method').annotate(total=Sum('amount'), count=Count('id')).order_by('-total')
        )
        breakdown = {
            'payment_count': qs.count(),
            'by_method': [
                {
                    'method': row['method'],
                    'total': str(row['total'] or 0),
                    'count': row['count'],
                }
                for row in by_method
            ],
        }
        closing = CashClosing.objects.create(
            hotel=hotel,
            period_date=period,
            total_collected=total,
            breakdown=breakdown,
            notes=request.data.get('notes', ''),
            closed_by=request.user,
        )
        audit(hotel, request.user, 'CASH_CLOSE', 'CashClosing', closing.id, new={
            'total': str(total), 'breakdown': breakdown,
        })
        return Response(CashClosingSerializer(closing).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsCashierOrAdmin])
def cashier_dashboard(request):
    """Dashboard caissier : encaissements du jour + soldes en attente."""
    hotel = _hotel(request)
    today = date.today()

    payments_today = (
        Payment.objects.filter(
            folio__stay__hotel=hotel, status='PAID', paid_at__date=today,
        )
        .select_related(
            'folio', 'folio__guest', 'folio__stay__room', 'folio__stay__reservation',
        )
        .order_by('-paid_at')
    )
    revenue_today = payments_today.aggregate(s=Sum('amount'))['s'] or Decimal('0')
    by_method = (
        payments_today.values('method')
        .annotate(total=Sum('amount'), count=Count('id'))
        .order_by('-total')
    )

    unpaid_folios = (
        Folio.objects.filter(stay__hotel=hotel, status='OPEN', balance__gt=0)
        .select_related('guest', 'stay', 'stay__room', 'stay__reservation')
        .order_by('-balance')
    )
    unpaid_total = unpaid_folios.aggregate(s=Sum('balance'))['s'] or Decimal('0')

    closing = CashClosing.objects.filter(hotel=hotel, period_date=today).first()

    return Response({
        'date': str(today),
        'revenue_today': revenue_today,
        'payments_today_count': payments_today.count(),
        'payments_by_method': [
            {
                'method': row['method'],
                'total': row['total'] or Decimal('0'),
                'count': row['count'],
            }
            for row in by_method
        ],
        'payments_today': PaymentSerializer(payments_today[:20], many=True).data,
        'unpaid_folios_count': unpaid_folios.count(),
        'unpaid_balance_total': unpaid_total,
        'unpaid_folios': FolioSerializer(unpaid_folios[:30], many=True).data,
        'cash_closed_today': bool(closing and closing.is_locked),
        'cash_closing': CashClosingSerializer(closing).data if closing else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsHotelStaff])
def availability(request):
    hotel = _hotel(request)
    room_type_id = request.query_params.get('room_type')
    check_in = request.query_params.get('check_in')
    check_out = request.query_params.get('check_out')
    if not (room_type_id and check_in and check_out):
        return Response({'detail': 'room_type, check_in, check_out requis.'}, status=400)
    ci = date.fromisoformat(check_in)
    co = date.fromisoformat(check_out)
    rooms = available_rooms(hotel, room_type_id, ci, co)
    return Response(RoomSerializer(rooms, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsHotelStaff])
def dashboard_stats(request):
    hotel = _hotel(request)
    today = date.today()

    # Déclenche les rappels J-1 (idempotent) à chaque consultation du dashboard
    try:
        from .departure_reminders import process_departure_reminders
        process_departure_reminders(hotel=hotel)
    except Exception:
        pass

    arrivals = Reservation.objects.filter(
        hotel=hotel, check_in_date=today, status__in=('CONFIRMED', 'EXPECTED', 'PENDING')
    ).count()
    departures = Stay.objects.filter(
        hotel=hotel, status='IN_HOUSE', reservation__check_out_date=today
    ).count()
    tomorrow = today + timedelta(days=1)
    departures_tomorrow_qs = (
        Reservation.objects.filter(
            hotel=hotel,
            check_out_date=tomorrow,
            status__in=('CHECKED_IN', 'CONFIRMED', 'EXPECTED'),
        )
        .select_related('guest', 'room_type', 'room')
        .order_by('check_out_date')
    )
    departures_tomorrow = departures_tomorrow_qs.count()
    departures_tomorrow_list = []
    for res in departures_tomorrow_qs[:8]:
        guest_name = ''
        if res.guest_id:
            guest_name = f'{res.guest.first_name or ""} {res.guest.last_name or ""}'.strip()
        room_label = ''
        if res.room_id:
            room_label = f'Ch. {res.room.number}'
        elif res.room_type_id:
            room_label = res.room_type.name
        departures_tomorrow_list.append({
            'id': str(res.id),
            'reference': res.reference or '',
            'guest_name': guest_name,
            'room_label': room_label,
            'status': res.status,
            'check_out_date': str(res.check_out_date or ''),
            'reminded': bool(res.departure_reminder_sent_at),
        })
    in_house = Stay.objects.filter(hotel=hotel, status='IN_HOUSE').count()
    available = Room.objects.filter(
        hotel=hotel, is_active=True, operational_status='AVAILABLE', housekeeping_status='READY'
    ).count()
    occupied = Room.objects.filter(hotel=hotel, operational_status='OCCUPIED').count()
    total_rooms = Room.objects.filter(hotel=hotel, is_active=True).count()
    hk_pending = HousekeepingTask.objects.filter(hotel=hotel, status__in=('PENDING', 'ASSIGNED', 'IN_PROGRESS')).count()
    hk_cleaning_required = Room.objects.filter(
        hotel=hotel, is_active=True, housekeeping_status='CLEANING_REQUIRED',
    ).count()
    hk_unassigned = HousekeepingTask.objects.filter(
        hotel=hotel, status='PENDING', assigned_to__isnull=True,
    ).count()
    maint_open = MaintenanceTicket.objects.filter(
        hotel=hotel, status__in=('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING')
    ).count()
    oom = Room.objects.filter(hotel=hotel, operational_status__in=('MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE')).count()
    unpaid = Folio.objects.filter(stay__hotel=hotel, status='OPEN', balance__gt=0).count()
    revenue_today = Payment.objects.filter(
        folio__stay__hotel=hotel, status='PAID', paid_at__date=today
    ).aggregate(s=Sum('amount'))['s'] or 0
    week_start = today - timedelta(days=6)
    prev_week_start = today - timedelta(days=13)
    prev_week_end = today - timedelta(days=7)
    month_start = today - timedelta(days=29)
    revenue_7d = Payment.objects.filter(
        folio__stay__hotel=hotel, status='PAID', paid_at__date__gte=week_start, paid_at__date__lte=today,
    ).aggregate(s=Sum('amount'))['s'] or 0
    revenue_prev_7d = Payment.objects.filter(
        folio__stay__hotel=hotel, status='PAID',
        paid_at__date__gte=prev_week_start, paid_at__date__lte=prev_week_end,
    ).aggregate(s=Sum('amount'))['s'] or 0
    revenue_30d = Payment.objects.filter(
        folio__stay__hotel=hotel, status='PAID', paid_at__date__gte=month_start, paid_at__date__lte=today,
    ).aggregate(s=Sum('amount'))['s'] or 0
    upcoming = Reservation.objects.filter(
        hotel=hotel, check_in_date__gte=today, status__in=Reservation.ACTIVE_STATUSES
    ).count()
    pending_payment = Reservation.objects.filter(
        hotel=hotel,
        status__in=('PENDING', 'CONFIRMED', 'EXPECTED'),
        payment_status__in=('UNPAID', 'AWAITING_PIN', 'FAILED'),
        check_in_date__gte=today,
    ).count()
    pending_confirm = Reservation.objects.filter(
        hotel=hotel, status='PENDING', check_in_date__gte=today,
    ).count()

    # Occupation journalière 7 derniers jours + 7 prochains (nuits réservées)
    occ_window_start = today - timedelta(days=6)
    occ_window_end = today + timedelta(days=6)
    active_for_occ = list(
        Reservation.objects.filter(hotel=hotel)
        .exclude(status__in=('CANCELLED', 'EXPIRED', 'NO_SHOW', 'PENDING'))
        .filter(check_in_date__lt=occ_window_end + timedelta(days=1), check_out_date__gt=occ_window_start)
        .only('check_in_date', 'check_out_date')
    )
    occupancy_trend = []
    d = occ_window_start
    while d <= occ_window_end:
        nights = sum(
            1 for res in active_for_occ
            if res.check_in_date and res.check_out_date and res.check_in_date <= d < res.check_out_date
        )
        rate = round((nights / total_rooms) * 100, 1) if total_rooms else 0
        occupancy_trend.append({
            'date': str(d),
            'label': d.strftime('%d/%m'),
            'occupied': nights,
            'occupancy_rate': rate,
            'is_today': d == today,
            'is_future': d > today,
        })
        d += timedelta(days=1)

    def _pct_change(current, previous):
        cur = float(current or 0)
        prev = float(previous or 0)
        if prev <= 0:
            return None if cur <= 0 else 100.0
        return round(((cur - prev) / prev) * 100, 1)

    revenue_7d_change_pct = _pct_change(revenue_7d, revenue_prev_7d)

    from .client_messages import client_message_pending, last_client_message
    msg_candidates = (
        Reservation.objects.filter(hotel=hotel)
        .exclude(special_requests='')
        .exclude(special_requests__isnull=True)
        .exclude(status__in=('CANCELLED', 'EXPIRED', 'NO_SHOW'))
        .select_related('guest', 'room_type')
        .order_by('-updated_at')
    )
    client_messages_pending_list = []
    client_messages_pending_count = 0
    for res in msg_candidates:
        if not client_message_pending(res.special_requests or ''):
            continue
        client_messages_pending_count += 1
        if len(client_messages_pending_list) >= 8:
            continue
        guest_name = ''
        if res.guest_id:
            guest_name = f'{res.guest.first_name or ""} {res.guest.last_name or ""}'.strip()
        client_messages_pending_list.append({
            'id': str(res.id),
            'reference': res.reference or '',
            'guest_name': guest_name,
            'room_type_name': res.room_type.name if res.room_type_id else '',
            'preview': (last_client_message(res.special_requests or '') or '')[:160],
            'updated_at': res.updated_at.isoformat() if res.updated_at else None,
        })

    reschedule_qs = (
        Reservation.objects.filter(hotel=hotel, reschedule_status='PENDING')
        .exclude(status__in=('CANCELLED', 'EXPIRED', 'NO_SHOW'))
        .select_related('guest', 'room_type')
        .order_by('-reschedule_requested_at', '-updated_at')
    )
    reschedule_pending_count = reschedule_qs.count()
    reschedule_pending_list = []
    for res in reschedule_qs[:8]:
        guest_name = ''
        if res.guest_id:
            guest_name = f'{res.guest.first_name or ""} {res.guest.last_name or ""}'.strip()
        kind = 'anticiper'
        if res.reschedule_preferred_check_in and res.check_in_date:
            if res.reschedule_preferred_check_in > res.check_in_date:
                kind = 'reporter'
            elif res.reschedule_preferred_check_in < res.check_in_date:
                kind = 'anticiper'
        reschedule_pending_list.append({
            'id': str(res.id),
            'reference': res.reference or '',
            'guest_name': guest_name,
            'room_type_name': res.room_type.name if res.room_type_id else '',
            'check_in_date': str(res.check_in_date or ''),
            'check_out_date': str(res.check_out_date or ''),
            'preferred_check_in': str(res.reschedule_preferred_check_in or ''),
            'preferred_check_out': str(res.reschedule_preferred_check_out or ''),
            'reason': (res.reschedule_reason or '')[:200],
            'kind': kind,
            'requested_at': (
                res.reschedule_requested_at.isoformat()
                if res.reschedule_requested_at else None
            ),
        })

    return Response({
        'arrivals_today': arrivals,
        'departures_today': departures,
        'in_house': in_house,
        'rooms_available': available,
        'rooms_occupied': occupied,
        'rooms_total': total_rooms,
        'occupancy_rate': round((occupied / total_rooms) * 100, 1) if total_rooms else 0,
        'hk_pending': hk_pending,
        'hk_cleaning_required': hk_cleaning_required,
        'hk_unassigned': hk_unassigned,
        'maintenance_open': maint_open,
        'rooms_oos': oom,
        'unpaid_folios': unpaid,
        'revenue_today': revenue_today,
        'revenue_7d': revenue_7d,
        'revenue_prev_7d': revenue_prev_7d,
        'revenue_7d_change_pct': revenue_7d_change_pct,
        'revenue_30d': revenue_30d,
        'upcoming_reservations': upcoming,
        'pending_confirm': pending_confirm,
        'pending_payment': pending_payment,
        'occupancy_trend': occupancy_trend,
        'client_messages_pending': client_messages_pending_count,
        'client_messages': client_messages_pending_list,
        'reschedule_pending': reschedule_pending_count,
        'reschedule_requests': reschedule_pending_list,
        'departures_tomorrow': departures_tomorrow,
        'departures_tomorrow_list': departures_tomorrow_list,
    })


def _is_hotel_business(business):
    cat = getattr(business, 'primary_category', None) or getattr(business, 'category', None)
    name = (getattr(cat, 'name', '') or '').lower()
    slug = (getattr(cat, 'slug', '') or '').lower()
    parent = getattr(getattr(cat, 'parent', None), 'name', '') or ''
    parent = parent.lower()
    return any(
        k in name or k in slug or k in parent
        for k in ('hôtel', 'hotel', 'hôtellerie', 'hotellerie')
    )


def _public_hotel_visible(business):
    """Hôtel listable / consultable côté client (annuaire public)."""
    if not business or not business.is_active or not business.is_verified:
        return False
    if not _is_hotel_business(business):
        return False
    profile = getattr(business, 'hotel_profile', None)
    if profile is None:
        try:
            profile = business.hotel_profile
        except Exception:
            profile = None
    if profile and getattr(profile, 'status', 'ACTIVE') != 'ACTIVE':
        return False
    return True


def _public_amenities(profile, extras=None):
    """Équipements publics = profil + attributs métier réels (pas de texte inventé)."""
    amenities = list(getattr(profile, 'amenities', None) or []) if profile else []
    extras = extras or {}
    if extras.get('has_swimming_pool') and 'Piscine' not in amenities:
        amenities.append('Piscine')
    if extras.get('breakfast_included') and 'Petit-déjeuner' not in amenities:
        amenities.append('Petit-déjeuner')
    return amenities


def _hotel_cover_and_gallery(business, profile=None, room_types=None):
    """
    Photo de couverture + galerie pour le parcours client.
    Priorité : guest_info.gallery → photos des types de chambres → logo.
    """
    profile = profile or getattr(business, 'hotel_profile', None)
    guest = (getattr(profile, 'guest_info', None) or {}) if profile else {}
    raw = guest.get('gallery') or guest.get('photos') or []
    gallery = [p for p in raw if isinstance(p, str) and p.strip()] if isinstance(raw, list) else []

    if len(gallery) < 6 and room_types:
        for t in room_types:
            photos = getattr(t, 'photos', None) or []
            if not isinstance(photos, list):
                continue
            for p in photos:
                if isinstance(p, str) and p.strip() and p not in gallery:
                    gallery.append(p)
                if len(gallery) >= 8:
                    break
            if len(gallery) >= 8:
                break

    logo = (getattr(business, 'logo', None) or '').strip()
    cover = gallery[0] if gallery else logo
    if logo and logo not in gallery and not gallery:
        gallery = [logo]
    return cover, gallery[:8]


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsPlatformHotelAdmin])
def platform_hotels(request):
    """Super Admin — liste des hôtels (actifs + suspendus) + KPIs légers."""
    from businesses.models import Business
    qs = Business.objects.all().select_related('primary_category', 'hotel_profile')
    hotels = [b for b in qs if _is_hotel_business(b)]
    today = date.today()
    data = []
    for b in hotels:
        rooms = Room.objects.filter(hotel=b, is_active=True).count()
        occupied = Room.objects.filter(hotel=b, operational_status='OCCUPIED').count()
        profile = getattr(b, 'hotel_profile', None)
        data.append({
            'id': str(b.id),
            'name': b.name,
            'city': getattr(b, 'commune', None) or getattr(b, 'province', None) or '',
            'phone': b.phone or '',
            'email': b.email or '',
            'is_active': bool(b.is_active),
            'is_verified': b.is_verified,
            'verification_status': getattr(b, 'verification_status', '') or '',
            'status': getattr(profile, 'status', 'ACTIVE') if profile else ('ACTIVE' if b.is_active else 'SUSPENDED'),
            'stars': getattr(profile, 'stars', None) if profile else None,
            'stars_verified': getattr(profile, 'stars_verified', None) if profile else None,
            'classification_verified': bool(getattr(profile, 'classification_verified', False)) if profile else False,
            'establishment_type': getattr(profile, 'establishment_type', 'HOTEL') if profile else 'HOTEL',
            'rooms_total': rooms,
            'rooms_occupied': occupied,
            'occupancy_rate': round((occupied / rooms) * 100, 1) if rooms else 0,
            'arrivals_today': Reservation.objects.filter(
                hotel=b, check_in_date=today, status__in=('CONFIRMED', 'EXPECTED', 'PENDING')
            ).count(),
            'in_house': Stay.objects.filter(hotel=b, status='IN_HOUSE').count(),
        })
    return Response({
        'count': len(data),
        'hotels': data,
        'totals': {
            'hotels': len(data),
            'rooms': sum(h['rooms_total'] for h in data),
            'occupied': sum(h['rooms_occupied'] for h in data),
            'in_house': sum(h['in_house'] for h in data),
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsPlatformHotelAdmin])
def platform_hotel_suspend(request, hotel_id):
    if not can_platform_hotel_suspend(request.user):
        raise PermissionDenied('Droit platform.businesses.suspend requis pour suspendre un hôtel.')
    from businesses.models import Business
    business = Business.objects.filter(id=hotel_id).first()
    if not business or not _is_hotel_business(business):
        return Response({'detail': 'Hôtel introuvable.'}, status=404)
    profile, _ = HotelProfile.objects.get_or_create(business=business)
    new_status = request.data.get('status', 'SUSPENDED')
    if new_status not in ('ACTIVE', 'SUSPENDED', 'CLOSED'):
        raise ValidationError({'status': 'Statut invalide.'})
    profile.status = new_status
    profile.save(update_fields=['status', 'updated_at'])
    if new_status != 'ACTIVE':
        business.is_active = False
        business.save(update_fields=['is_active'])
    else:
        business.is_active = True
        business.save(update_fields=['is_active'])
    return Response({'id': str(business.id), 'status': profile.status, 'is_active': business.is_active})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsPlatformHotelAdmin])
def platform_hotel_verify_classification(request, hotel_id):
    """Valide les étoiles / classification officielle (déclarée ≠ vérifiée — HOTELLERIE 2)."""
    if not can_platform_hotel_verify(request.user):
        raise PermissionDenied('Droit de modération ou mise à jour requis pour vérifier la classification.')
    from accounts.models import AuditLog
    from businesses.models import Business
    business = Business.objects.filter(id=hotel_id).first()
    if not business or not _is_hotel_business(business):
        return Response({'detail': 'Hôtel introuvable.'}, status=404)
    profile, _ = HotelProfile.objects.get_or_create(business=business)
    previous = {
        'stars_verified': profile.stars_verified,
        'classification_verified': bool(profile.classification_verified),
        'stars_declared': profile.stars,
    }
    stars = request.data.get('stars_verified', profile.stars)
    try:
        stars = int(stars) if stars is not None and stars != '' else None
    except (TypeError, ValueError):
        raise ValidationError({'stars_verified': 'Nombre d\'étoiles invalide.'})
    if stars is not None and (stars < 0 or stars > 5):
        raise ValidationError({'stars_verified': 'Les étoiles doivent être entre 0 et 5.'})
    verified = request.data.get('classification_verified', True)
    note = (request.data.get('note') or request.data.get('audit_note') or '').strip()[:500]
    profile.stars_verified = stars
    profile.classification_verified = bool(verified)
    profile.save(update_fields=['stars_verified', 'classification_verified', 'updated_at'])
    new_value = {
        'stars_verified': profile.stars_verified,
        'classification_verified': profile.classification_verified,
        'stars_declared': profile.stars,
        'note': note,
    }
    audit(
        business,
        request.user,
        'CLASSIFICATION_VERIFY',
        'HotelProfile',
        profile.id,
        old=previous,
        new=new_value,
    )
    AuditLog.objects.create(
        user=request.user,
        user_email=getattr(request.user, 'email', '') or '',
        user_role=getattr(request.user, 'role', '') or '',
        action='HOTEL_CLASSIFICATION_VERIFIED',
        resource=f'hotel:{business.id}',
        details={
            'business_name': business.name,
            'business_id': str(business.id),
            'old': previous,
            'new': new_value,
        },
    )
    return Response({
        'id': str(business.id),
        'stars_declared': profile.stars,
        'stars_verified': profile.stars_verified,
        'classification_verified': profile.classification_verified,
        'display_stars': profile.display_stars,
    })


def _parse_date_param(raw, field='date'):
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw)[:10])
    except (TypeError, ValueError):
        raise ValidationError({field: 'Format attendu YYYY-MM-DD.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsHotelStaff])
def occupancy_calendar(request):
    """Calendrier occupation : chambres × événements (résas / séjours) sur une plage."""
    hotel = _hotel(request)
    today = date.today()
    start = _parse_date_param(request.query_params.get('from') or request.query_params.get('start'), 'from') or today
    end = _parse_date_param(request.query_params.get('to') or request.query_params.get('end'), 'to') or (start + timedelta(days=13))
    if end < start:
        raise ValidationError({'to': 'La date de fin doit être ≥ date de début.'})
    if (end - start).days > 62:
        raise ValidationError({'to': 'Plage max. 62 jours.'})

    rooms = list(
        Room.objects.filter(hotel=hotel, is_active=True)
        .select_related('room_type')
        .order_by('floor', 'number')
    )
    room_payload = [
        {
            'id': str(r.id),
            'number': r.number,
            'floor': r.floor,
            'room_type': r.room_type.name if r.room_type_id else '',
            'operational_status': r.operational_status,
            'housekeeping_status': r.housekeeping_status,
        }
        for r in rooms
    ]

    # Réservations chevauchant [start, end) — check_out exclusif
    res_qs = (
        Reservation.objects.filter(hotel=hotel)
        .exclude(status__in=('CANCELLED', 'EXPIRED', 'NO_SHOW'))
        .filter(check_in_date__lt=end, check_out_date__gt=start)
        .select_related('guest', 'room', 'room_type')
    )
    events = []
    for res in res_qs:
        guest_name = ''
        if res.guest_id:
            guest_name = f'{res.guest.first_name or ""} {res.guest.last_name or ""}'.strip()
        events.append({
            'id': str(res.id),
            'kind': 'STAY' if res.status == 'CHECKED_IN' else 'RESERVATION',
            'reference': res.reference or '',
            'status': res.status,
            'guest_name': guest_name,
            'room_id': str(res.room_id) if res.room_id else None,
            'room_number': res.room.number if res.room_id else '',
            'room_type': res.room_type.name if res.room_type_id else '',
            'start': str(res.check_in_date),
            'end': str(res.check_out_date),
        })

    days = []
    d = start
    while d <= end:
        days.append(str(d))
        d += timedelta(days=1)

    return Response({
        'from': str(start),
        'to': str(end),
        'days': days,
        'rooms': room_payload,
        'events': events,
    })


def _hotel_reports_payload(hotel, start, end):
    """Occupation journalière, revenus par méthode, synthèses Occupancy/ADR/RevPAR."""
    total_rooms = Room.objects.filter(hotel=hotel, is_active=True).count()
    active_res = (
        Reservation.objects.filter(hotel=hotel)
        .exclude(status__in=('CANCELLED', 'EXPIRED', 'NO_SHOW', 'PENDING'))
        .filter(check_in_date__lt=end + timedelta(days=1), check_out_date__gt=start)
        .only('check_in_date', 'check_out_date', 'status')
    )
    daily = []
    room_nights = 0
    d = start
    while d <= end:
        occupied_nights = 0
        for res in active_res:
            if res.check_in_date <= d < res.check_out_date:
                occupied_nights += 1
        room_nights += occupied_nights
        occ = round((occupied_nights / total_rooms) * 100, 1) if total_rooms else 0
        daily.append({
            'date': str(d),
            'rooms_sold': occupied_nights,
            'rooms_total': total_rooms,
            'occupancy_rate': occ,
        })
        d += timedelta(days=1)

    payments = Payment.objects.filter(
        folio__stay__hotel=hotel,
        status='PAID',
        paid_at__date__gte=start,
        paid_at__date__lte=end,
    )
    by_method = {}
    for row in payments.values('method').annotate(total=Sum('amount'), count=Count('id')):
        by_method[row['method'] or 'OTHER'] = {
            'amount': row['total'] or Decimal('0'),
            'count': row['count'],
        }
    revenue_total = payments.aggregate(s=Sum('amount'))['s'] or Decimal('0')
    nights = max(1, (end - start).days + 1)
    avg_occ = round(sum(x['occupancy_rate'] for x in daily) / len(daily), 1) if daily else 0
    adr = round(float(revenue_total) / room_nights, 0) if room_nights else 0
    revpar = round(float(revenue_total) / (total_rooms * nights), 0) if total_rooms and nights else 0

    return {
        'from': str(start),
        'to': str(end),
        'hotel_name': getattr(hotel, 'name', '') or '',
        'summary': {
            'rooms_total': total_rooms,
            'room_nights_sold': room_nights,
            'avg_occupancy_rate': avg_occ,
            'revenue_total': revenue_total,
            'adr': adr,
            'revpar': revpar,
            'arrivals': Reservation.objects.filter(
                hotel=hotel, check_in_date__gte=start, check_in_date__lte=end,
                status__in=('CONFIRMED', 'EXPECTED', 'CHECKED_IN', 'CHECKED_OUT'),
            ).count(),
            'departures': Reservation.objects.filter(
                hotel=hotel, check_out_date__gte=start, check_out_date__lte=end,
                status__in=('CHECKED_OUT', 'CHECKED_IN', 'CONFIRMED'),
            ).count(),
        },
        'revenue_by_method': by_method,
        'daily': daily,
    }


def _hotel_reports_csv(payload):
    buf = io.StringIO()
    writer = csv.writer(buf)
    summary = payload.get('summary') or {}
    writer.writerow(['Rapport hôtel', payload.get('hotel_name') or ''])
    writer.writerow(['Période', f"{payload.get('from')} → {payload.get('to')}"])
    writer.writerow([])
    writer.writerow(['Indicateur', 'Valeur'])
    writer.writerow(['Chambres', summary.get('rooms_total')])
    writer.writerow(['Nuits vendues', summary.get('room_nights_sold')])
    writer.writerow(['Occupation moy. %', summary.get('avg_occupancy_rate')])
    writer.writerow(['Revenu total (BIF)', summary.get('revenue_total')])
    writer.writerow(['ADR (BIF)', summary.get('adr')])
    writer.writerow(['RevPAR (BIF)', summary.get('revpar')])
    writer.writerow(['Arrivées', summary.get('arrivals')])
    writer.writerow(['Départs', summary.get('departures')])
    writer.writerow([])
    writer.writerow(['Revenus par moyen'])
    writer.writerow(['Moyen', 'Montant', 'Nombre'])
    for method, row in (payload.get('revenue_by_method') or {}).items():
        writer.writerow([method, row.get('amount'), row.get('count')])
    writer.writerow([])
    writer.writerow(['Occupation journalière'])
    writer.writerow(['Date', 'Vendues', 'Total', 'Occ. %'])
    for row in payload.get('daily') or []:
        writer.writerow([row.get('date'), row.get('rooms_sold'), row.get('rooms_total'), row.get('occupancy_rate')])

    filename = f"rapport-hotel-{payload.get('from')}_{payload.get('to')}.csv"
    response = HttpResponse(buf.getvalue().encode('utf-8-sig'), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsHotelStaff])
def hotel_reports(request):
    """Rapports v1 : occupation journalière, revenus par méthode, synthèses. ?format=csv pour export."""
    hotel = _hotel(request)
    today = date.today()
    start = _parse_date_param(request.query_params.get('from'), 'from') or (today - timedelta(days=29))
    end = _parse_date_param(request.query_params.get('to'), 'to') or today
    if end < start:
        raise ValidationError({'to': 'La date de fin doit être ≥ date de début.'})
    if (end - start).days > 366:
        raise ValidationError({'to': 'Plage max. 366 jours.'})

    payload = _hotel_reports_payload(hotel, start, end)
    export = (request.query_params.get('export') or request.query_params.get('format') or '').strip().lower()
    if export == 'csv':
        return _hotel_reports_csv(payload)
    return Response(payload)

@api_view(['GET'])
@permission_classes([AllowAny])
def public_hotels(request):
    """
    Annuaire public — filtres HOTELLERIE 2 :
    q, city/destination, check_in, check_out, guests, budget_max, establishment_type, stars_min
    """
    from businesses.models import Business
    from decimal import Decimal, InvalidOperation

    qs = Business.objects.filter(is_active=True, is_verified=True).select_related(
        'primary_category', 'hotel_profile'
    )
    q = (request.query_params.get('q') or '').strip().lower()
    city = (request.query_params.get('city') or request.query_params.get('destination') or '').strip().lower()
    check_in = request.query_params.get('check_in')
    check_out = request.query_params.get('check_out')
    guests_raw = request.query_params.get('guests') or request.query_params.get('adults')
    budget_raw = request.query_params.get('budget_max')
    est_type = (request.query_params.get('establishment_type') or '').strip().upper()
    stars_min_raw = request.query_params.get('stars_min')

    guests = None
    if guests_raw:
        try:
            guests = max(1, int(guests_raw))
        except (TypeError, ValueError):
            guests = None
    budget_max = None
    if budget_raw:
        try:
            budget_max = Decimal(str(budget_raw))
        except (InvalidOperation, TypeError, ValueError):
            budget_max = None
    stars_min = None
    if stars_min_raw:
        try:
            stars_min = max(0, int(stars_min_raw))
        except (TypeError, ValueError):
            stars_min = None

    need_dates = bool(check_in and check_out)
    ci = co = None
    if need_dates:
        try:
            ci = date.fromisoformat(check_in)
            co = date.fromisoformat(check_out)
            if co <= ci:
                need_dates = False
        except ValueError:
            need_dates = False

    hotels = []
    for b in qs:
        if not _public_hotel_visible(b):
            continue
        profile = getattr(b, 'hotel_profile', None)

        if city:
            blob = ' '.join([
                str(getattr(b, 'commune', '') or ''),
                str(getattr(b, 'province', '') or ''),
                str(b.address or ''),
                str(b.name or ''),
            ]).lower()
            if city not in blob:
                continue

        if q:
            blob = ' '.join([
                str(b.name or ''),
                str(b.description or ''),
                str(getattr(b, 'commune', '') or ''),
                str(getattr(profile, 'trade_name', '') or ''),
            ]).lower()
            if q not in blob:
                continue

        if est_type and profile and (profile.establishment_type or 'HOTEL') != est_type:
            continue

        display_stars = None
        if profile:
            display_stars = profile.display_stars
        if stars_min is not None:
            if display_stars is None or int(display_stars) < stars_min:
                continue

        types_qs = RoomType.objects.filter(hotel=b, is_active=True)
        if guests:
            types_qs = types_qs.filter(capacity_adults__gte=guests)
        types = list(types_qs)
        if guests and not types:
            continue

        if budget_max is not None:
            types = [t for t in types if (t.base_price or 0) <= budget_max]
            if not types:
                continue

        available_types = 0
        if need_dates and types:
            for t in types:
                if available_rooms(b, t.id, ci, co):
                    available_types += 1
            if available_types == 0:
                continue

        extras = getattr(b, 'extra_attributes', None) or {}
        amenities = _public_amenities(profile, extras)
        rates_for = [
            r.price_per_night for r in RatePlan.objects.filter(
                hotel=b, room_type__in=types, is_active=True,
            )
        ] if types else []
        from_price = float(min(rates_for, default=0) or 0)
        if not from_price and types:
            from_price = float(min((t.base_price for t in types), default=0) or 0)
        cover, gallery = _hotel_cover_and_gallery(b, profile, types)
        hotels.append({
            'id': str(b.id),
            'name': b.name,
            'trade_name': getattr(profile, 'trade_name', '') if profile else '',
            'logo': b.logo or '',
            'cover_photo': cover,
            'gallery': gallery,
            'description': (b.description or '')[:280],
            'address': b.address or '',
            'city': getattr(b, 'commune', None) or getattr(b, 'province', None) or '',
            'province': getattr(b, 'province', None) or '',
            'phone': b.phone or '',
            'establishment_type': getattr(profile, 'establishment_type', 'HOTEL') if profile else 'HOTEL',
            'stars': display_stars,
            'stars_declared': getattr(profile, 'stars', None) if profile else None,
            'stars_verified': getattr(profile, 'stars_verified', None) if profile else None,
            'classification_verified': bool(getattr(profile, 'classification_verified', False)) if profile else False,
            'check_in_time': str(getattr(profile, 'check_in_time', '14:00') or '14:00')[:5] if profile else '14:00',
            'check_out_time': str(getattr(profile, 'check_out_time', '12:00') or '12:00')[:5] if profile else '12:00',
            'currency': getattr(profile, 'currency', 'BIF') if profile else 'BIF',
            'languages': list(getattr(profile, 'languages', None) or []) if profile else [],
            'amenities': amenities,
            'latitude': getattr(b, 'latitude', None),
            'longitude': getattr(b, 'longitude', None),
            'room_types_count': len(types),
            'from_price': from_price,
            'available_for_dates': available_types if need_dates else None,
        })
    hotels.sort(key=lambda h: (h['from_price'] or 0, h['name'] or ''))
    return Response(hotels)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_hotel_detail(request, hotel_id):
    from businesses.models import Business
    b = Business.objects.filter(id=hotel_id).select_related('hotel_profile', 'primary_category').first()
    if not _public_hotel_visible(b):
        return Response({'detail': 'Hôtel introuvable.'}, status=404)
    profile = getattr(b, 'hotel_profile', None)
    types = RoomType.objects.filter(hotel=b, is_active=True).annotate(rooms_count=Count('rooms'))
    rates = RatePlan.objects.filter(hotel=b, is_active=True).select_related('room_type')
    services = HotelService.objects.filter(hotel=b, is_active=True)
    guest_info = (getattr(profile, 'guest_info', None) or {}) if profile else {}
    extras = getattr(b, 'extra_attributes', None) or {}
    amenities = _public_amenities(profile, extras)
    display_stars = profile.display_stars if profile else extras.get('stars_rating')
    cover, gallery = _hotel_cover_and_gallery(b, profile, list(types))
    return Response({
        'id': str(b.id),
        'name': b.name,
        'trade_name': getattr(profile, 'trade_name', '') if profile else '',
        'establishment_type': getattr(profile, 'establishment_type', 'HOTEL') if profile else 'HOTEL',
        'logo': b.logo or '',
        'cover_photo': cover,
        'gallery': gallery,
        'description': b.description or '',
        'address': b.address or '',
        'city': getattr(b, 'commune', None) or getattr(b, 'province', None) or '',
        'province': getattr(b, 'province', None) or '',
        'phone': b.phone or '',
        'email': b.email or '',
        'website': b.website or '',
        'latitude': getattr(b, 'latitude', None),
        'longitude': getattr(b, 'longitude', None),
        'stars': display_stars,
        'stars_declared': getattr(profile, 'stars', None) if profile else extras.get('stars_rating'),
        'stars_verified': getattr(profile, 'stars_verified', None) if profile else None,
        'classification_verified': bool(getattr(profile, 'classification_verified', False)) if profile else False,
        'check_in_time': str(getattr(profile, 'check_in_time', '14:00') or '14:00')[:5] if profile else '14:00',
        'check_out_time': str(getattr(profile, 'check_out_time', '12:00') or '12:00')[:5] if profile else '12:00',
        'customer_service_hours': getattr(profile, 'customer_service_hours', '') if profile else '',
        'languages': list(getattr(profile, 'languages', None) or []) if profile else [],
        'currency': getattr(profile, 'currency', 'BIF') if profile else 'BIF',
        'cancellation_policy': getattr(profile, 'cancellation_policy', '') if profile else '',
        'stay_conditions': getattr(profile, 'stay_conditions', '') if profile else '',
        'pets_allowed': bool(getattr(profile, 'pets_allowed', False)) if profile else False,
        'smoking_allowed': bool(getattr(profile, 'smoking_allowed', False)) if profile else False,
        'deposit_policy': getattr(profile, 'deposit_policy', '') if profile else '',
        'amenities': amenities,
        'guest_info': guest_info,
        'rooms_count_declared': extras.get('rooms_count') or None,
        'room_types': RoomTypeSerializer(types, many=True).data,
        'rates': synthetic_rates_for_public(b, types, list(rates)),
        'services': HotelServiceSerializer(services, many=True).data,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def public_availability(request, hotel_id):
    from businesses.models import Business
    b = Business.objects.filter(id=hotel_id).first()
    if not _public_hotel_visible(b):
        return Response({'detail': 'Hôtel introuvable.'}, status=404)
    room_type_id = request.query_params.get('room_type')
    check_in = request.query_params.get('check_in')
    check_out = request.query_params.get('check_out')
    if not (room_type_id and check_in and check_out):
        return Response({'detail': 'room_type, check_in, check_out requis.'}, status=400)
    rooms = available_rooms(b, room_type_id, date.fromisoformat(check_in), date.fromisoformat(check_out))
    return Response({
        'available_count': len(rooms),
        'rooms': [{'id': str(r.id), 'number': r.number} for r in rooms],
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def public_book(request, hotel_id):
    """Réservation en ligne client → statut PENDING (confirmée par l'hôtel)."""
    from businesses.models import Business
    from .services import compute_total, next_reference
    b = Business.objects.filter(id=hotel_id).select_related('hotel_profile').first()
    if not _public_hotel_visible(b):
        return Response({'detail': 'Hôtel introuvable.'}, status=404)
    profile = getattr(b, 'hotel_profile', None)
    data = request.data
    room_type = RoomType.objects.filter(hotel=b, id=data.get('room_type'), is_active=True).first()
    if not room_type:
        raise ValidationError({'room_type': 'Type de chambre invalide.'})
    try:
        ci = date.fromisoformat(data.get('check_in_date'))
        co = date.fromisoformat(data.get('check_out_date'))
    except Exception:
        raise ValidationError({'dates': 'Dates invalides.'})
    if co <= ci:
        raise ValidationError({'check_out_date': 'Départ après arrivée.'})
    free = available_rooms(b, room_type.id, ci, co)
    if not free:
        raise ValidationError({'availability': 'Aucune chambre disponible sur ces dates.'})
    first = (data.get('first_name') or '').strip()
    last = (data.get('last_name') or '').strip()
    if not first or not last:
        raise ValidationError({'guest': 'Nom et prénom requis.'})
    auth_user = request.user if getattr(request.user, 'is_authenticated', False) else None
    email = (data.get('email') or '').strip()
    if auth_user and not email:
        email = auth_user.email or ''
    guest = Guest.objects.create(
        hotel=b,
        user=auth_user,
        first_name=first,
        last_name=last,
        phone=data.get('phone') or (getattr(auth_user, 'phone_number', None) or ''),
        email=email,
        notes=data.get('notes') or '',
    )
    rate_id = data.get('rate_plan')
    rate = None
    if rate_id and not str(rate_id).startswith('base:'):
        rate = RatePlan.objects.filter(
            hotel=b, id=rate_id, room_type=room_type, is_active=True,
        ).first()
        if not rate:
            raise ValidationError({'rate_plan': 'Tarif invalide pour ce type de chambre.'})
    if not rate:
        rate, _meta = resolve_rate_plan(b, room_type, auto_create=True, notify=True)
    if not rate:
        raise ValidationError({
            'rate_plan': (
                'Ce type de chambre n’est pas encore disponible à la réservation. '
                'Veuillez choisir un autre type ou réessayer plus tard.'
            ),
        })

    adults = int(data.get('adults') or 1)
    children = int(data.get('children') or 0)
    if adults > (room_type.capacity_adults or 0):
        raise ValidationError({
            'adults': f'Maximum {room_type.capacity_adults} adulte(s) pour ce type.',
        })
    if children > (room_type.capacity_children or 0):
        raise ValidationError({
            'children': f'Maximum {room_type.capacity_children} enfant(s) pour ce type.',
        })

    amount = rate.price_per_night
    total, _ = compute_total(amount, ci, co)
    res = Reservation.objects.create(
        reference=next_reference(b, 'RES'),
        hotel=b,
        guest=guest,
        room_type=room_type,
        rate_plan=rate,
        check_in_date=ci,
        check_out_date=co,
        adults=adults,
        children=children,
        status='PENDING',
        source='ONLINE',
        special_requests=data.get('special_requests') or '',
        amount_per_night=amount,
        total_amount=total,
        currency=rate.currency or getattr(getattr(b, 'hotel_profile', None), 'currency', None) or 'BIF',
        created_by=auth_user,
    )
    from .reservation_payment import apply_payment_snapshot, initiate_reservation_payment
    from businesses import burundipay as burundipay_client
    apply_payment_snapshot(res)
    res.save(update_fields=[
        'currency', 'payment_status', 'payment_method', 'paid_at',
        'payment_note', 'payment_merchant_account', 'updated_at',
    ])

    payment_result = None
    payer_phone = (data.get('payer_phone') or '').strip()
    try:
        amount_int = int(round(float(res.total_amount or 0)))
    except (TypeError, ValueError):
        amount_int = 0
    if amount_int > 0 and payer_phone:
        payment_result = initiate_reservation_payment(res, payer_phone)
        res.refresh_from_db()

    audit(b, auth_user, 'PUBLIC_BOOK', 'Reservation', res.id)
    from .reservation_notifications import notify_reservation_requested
    email_result = notify_reservation_requested(res)
    payload = {
        'id': str(res.id),
        'reference': res.reference,
        'status': res.status,
        'total_amount': str(res.total_amount),
        'currency': res.currency or 'BIF',
        'check_in_date': str(res.check_in_date),
        'check_out_date': str(res.check_out_date),
        'hotel_name': b.name,
        'payment_status': res.payment_status,
        'payment_method': res.payment_method,
        'payer_phone': res.payer_phone,
        'payment_merchant_account': res.payment_merchant_account,
        'message': 'Demande envoyée. L\'hôtel confirmera votre réservation après paiement.',
        'email_notification': email_result,
    }
    if payment_result:
        payload['payment_initiation'] = {
            'ok': payment_result.get('ok'),
            'message': payment_result.get('message') or '',
            'stub_mode': payment_result.get('stub_mode', burundipay_client.is_stub_mode()),
            'amount_bif': payment_result.get('amount_bif'),
        }
        if not payment_result.get('ok') and not payment_result.get('already_paid'):
            payload['message'] = (
                'Réservation enregistrée, mais le paiement n\'a pas pu être initié. '
                'Vous pouvez réessayer.'
            )
    if email_result and not email_result.get('sent'):
        payload['message'] = (
            (payload.get('message') or 'Demande enregistrée.')
            + f" Email non envoyé : {email_result.get('error') or 'adresse manquante'}."
        )
    return Response(payload, status=status.HTTP_201_CREATED)


def _public_reservation_payload(res):
    return {
        'id': str(res.id),
        'reference': res.reference,
        'status': res.status,
        'total_amount': str(res.total_amount),
        'currency': res.currency or 'BIF',
        'check_in_date': str(res.check_in_date),
        'check_out_date': str(res.check_out_date),
        'hotel_name': res.hotel.name if res.hotel_id else '',
        'payment_status': res.payment_status,
        'payment_method': res.payment_method,
        'payer_phone': res.payer_phone,
        'payment_merchant_account': res.payment_merchant_account,
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def public_pay_reservation(request, reservation_id):
    """Initie / relance le paiement BurundiPay d'une réservation publique."""
    from .reservation_payment import initiate_reservation_payment
    from businesses import burundipay as burundipay_client

    res = Reservation.objects.select_related('hotel').filter(id=reservation_id).first()
    if not res:
        return Response({'detail': 'Réservation introuvable.'}, status=404)
    payer_phone = (request.data.get('payer_phone') or request.data.get('phone') or '').strip()
    if not payer_phone:
        return Response({'error': 'payer_phone (BurundiPay) requis.'}, status=400)
    result = initiate_reservation_payment(res, payer_phone)
    res.refresh_from_db()
    return Response({
        'ok': result.get('ok'),
        'already_paid': result.get('already_paid', False),
        'message': result.get('message') or '',
        'detail': result.get('message') or 'Paiement impossible.',
        'stub_mode': result.get('stub_mode', burundipay_client.is_stub_mode()),
        'amount_bif': result.get('amount_bif'),
        'currency': result.get('currency', res.currency),
        'reservation': _public_reservation_payload(res),
    }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def public_confirm_reservation_payment(request, reservation_id):
    """Simulation : confirme le PIN BurundiPay pour une réservation publique."""
    from .reservation_payment import confirm_reservation_payment_stub

    res = Reservation.objects.select_related('hotel').filter(id=reservation_id).first()
    if not res:
        return Response({'detail': 'Réservation introuvable.'}, status=404)
    result = confirm_reservation_payment_stub(res)
    res.refresh_from_db()
    return Response({
        'ok': result.get('ok'),
        'message': result.get('message') or '',
        'reservation': _public_reservation_payload(res),
    }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_reservations(request):
    """Réservations hôtel du client connecté (par user ou email)."""
    user = request.user
    email = (user.email or '').strip()
    qs = Reservation.objects.filter(
        Q(guest__user=user) | Q(created_by=user) | (Q(guest__email__iexact=email) if email else Q(pk__isnull=True))
    ).select_related('hotel', 'guest', 'room_type', 'room').order_by('-created_at')
    hotel_id = request.query_params.get('hotel') or request.query_params.get('hotel_id')
    if hotel_id:
        qs = qs.filter(hotel_id=hotel_id)
    data = []
    for r in qs[:100]:
        data.append({
            'id': str(r.id),
            'reference': r.reference,
            'status': r.status,
            'hotel_id': str(r.hotel_id),
            'hotel_name': r.hotel.name,
            'room_type_name': r.room_type.name if r.room_type_id else '',
            'room_number': r.room.number if r.room_id else '',
            'check_in_date': str(r.check_in_date),
            'check_out_date': str(r.check_out_date),
            'nights': r.nights,
            'adults': r.adults,
            'children': r.children,
            'total_amount': str(r.total_amount),
            'currency': r.currency or 'BIF',
            'payment_status': r.payment_status,
            'payment_method': r.payment_method,
            'payer_phone': r.payer_phone,
            'special_requests': r.special_requests or '',
            'decision_note': r.decision_note or '',
            'decision_at': r.decision_at.isoformat() if r.decision_at else '',
            'reschedule_status': r.reschedule_status or 'NONE',
            'reschedule_preferred_check_in': str(r.reschedule_preferred_check_in or ''),
            'reschedule_preferred_check_out': str(r.reschedule_preferred_check_out or ''),
            'reschedule_reason': r.reschedule_reason or '',
            'reschedule_admin_note': r.reschedule_admin_note or '',
            'reschedule_requested_at': r.reschedule_requested_at.isoformat() if r.reschedule_requested_at else '',
            'reschedule_resolved_at': r.reschedule_resolved_at.isoformat() if r.reschedule_resolved_at else '',
            'departure_reminder_sent_at': (
                r.departure_reminder_sent_at.isoformat() if r.departure_reminder_sent_at else ''
            ),
            'departure_reminder_note': r.departure_reminder_note or '',
            'departure_tomorrow': bool(
                r.check_out_date
                and r.check_out_date == (timezone.localdate() + timedelta(days=1))
                and r.status in ('CHECKED_IN', 'CONFIRMED', 'EXPECTED')
            ),
            'created_at': r.created_at.isoformat() if r.created_at else '',
        })
    return Response(data)


def _client_owns_reservation(user, res):
    if not user or not user.is_authenticated or not res:
        return False
    email = (user.email or '').strip().lower()
    if res.created_by_id == user.id:
        return True
    guest = res.guest
    if guest and guest.user_id == user.id:
        return True
    if guest and email and (guest.email or '').strip().lower() == email:
        return True
    return False


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def public_reservation_message(request, reservation_id):
    """
    Message client → hôtel (historique / communication).
    Ajoute une note horodatée dans special_requests et notifie les agents réservations.
    """
    res = Reservation.objects.select_related('hotel', 'guest').filter(id=reservation_id).first()
    if not res:
        return Response({'detail': 'Réservation introuvable.'}, status=404)
    if not _client_owns_reservation(request.user, res):
        return Response({'detail': 'Accès refusé.'}, status=403)
    if res.status in ('CANCELLED', 'CHECKED_OUT', 'EXPIRED', 'NO_SHOW'):
        return Response({
            'detail': 'Cette réservation est clôturée ; message non autorisé.',
        }, status=400)

    message = (request.data.get('message') or request.data.get('note') or '').strip()
    if not message:
        return Response({'message': 'Message requis.'}, status=400)
    if len(message) > 2000:
        return Response({'message': 'Message trop long (max. 2000 caractères).'}, status=400)

    stamp = timezone.now().strftime('%Y-%m-%d %H:%M')
    author = (request.user.first_name or request.user.email or 'Client').strip()
    line = f'[{stamp} — {author}] {message}'
    prev = (res.special_requests or '').strip()
    res.special_requests = f'{prev}\n{line}'.strip() if prev else line
    res.save(update_fields=['special_requests', 'updated_at'])
    audit(
        res.hotel, request.user, 'CLIENT_MESSAGE', 'Reservation', res.id,
        new={'message': message[:200]},
    )

    from .rate_resolution import notify_hotel_ops
    notify_hotel_ops(
        res.hotel,
        title=f'Message client — {res.reference}',
        message=(
            f'Le client a envoyé un message sur la réservation {res.reference} '
            f'({res.room_type.name if res.room_type_id else "chambre"}).\n\n'
            f'« {message} »\n\n'
            f'Traitez la demande dans Réservations.'
        ),
        need_reservations=True,
    )
    return Response({
        'ok': True,
        'id': str(res.id),
        'reference': res.reference,
        'special_requests': res.special_requests,
        'message': 'Message envoyé à l’hôtel.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def public_request_reschedule(request, reservation_id):
    """
    Client : demander d'anticiper ou de reporter les dates du séjour.
    Body : { reason, preferred_check_in, preferred_check_out }
    """
    res = Reservation.objects.select_related('hotel', 'guest', 'room_type').filter(id=reservation_id).first()
    if not res:
        return Response({'detail': 'Réservation introuvable.'}, status=404)
    if not _client_owns_reservation(request.user, res):
        return Response({'detail': 'Accès refusé.'}, status=403)
    if res.status not in ('PENDING', 'CONFIRMED', 'EXPECTED'):
        return Response({
            'detail': 'Modification de dates impossible pour ce statut.',
        }, status=400)
    if res.reschedule_status == 'PENDING':
        return Response({
            'detail': 'Une demande de modification est déjà en attente de réponse de l’hôtel.',
        }, status=400)

    reason = (request.data.get('reason') or '').strip()
    if not reason:
        return Response({'reason': 'Indiquez le motif de votre demande.'}, status=400)

    try:
        pref_in = date.fromisoformat(str(request.data.get('preferred_check_in') or ''))
        pref_out = date.fromisoformat(str(request.data.get('preferred_check_out') or ''))
    except Exception:
        return Response({
            'dates': 'Indiquez les nouvelles dates souhaitées (arrivée et départ).',
        }, status=400)
    if pref_out <= pref_in:
        return Response({'preferred_check_out': 'Le départ doit être après l’arrivée.'}, status=400)
    if pref_in < date.today():
        return Response({'preferred_check_in': 'La nouvelle arrivée ne peut pas être dans le passé.'}, status=400)
    if pref_in == res.check_in_date and pref_out == res.check_out_date:
        return Response({
            'dates': 'Choisissez des dates différentes de votre réservation actuelle.',
        }, status=400)

    res.reschedule_status = 'PENDING'
    res.reschedule_preferred_check_in = pref_in
    res.reschedule_preferred_check_out = pref_out
    res.reschedule_reason = reason[:2000]
    res.reschedule_admin_note = ''
    res.reschedule_requested_at = timezone.now()
    res.reschedule_resolved_at = None
    res.save(update_fields=[
        'reschedule_status', 'reschedule_preferred_check_in', 'reschedule_preferred_check_out',
        'reschedule_reason', 'reschedule_admin_note', 'reschedule_requested_at',
        'reschedule_resolved_at', 'updated_at',
    ])
    audit(
        res.hotel, request.user, 'RESCHEDULE_REQUEST', 'Reservation', res.id,
        new={
            'preferred_check_in': str(pref_in),
            'preferred_check_out': str(pref_out),
            'reason': reason[:200],
        },
    )
    from .rate_resolution import notify_hotel_ops
    kind = 'anticiper' if pref_in < res.check_in_date else 'reporter'
    notify_hotel_ops(
        res.hotel,
        title=f'Demande pour {kind} — {res.reference}',
        message=(
            f'Le client souhaite {kind} son séjour {res.reference}.\n'
            f'Dates actuelles : {res.check_in_date} → {res.check_out_date}\n'
            f'Dates souhaitées : {pref_in} → {pref_out}\n'
            f'Motif : {reason}\n\n'
            f'Traitez la demande dans Réservations (accepter / refuser).'
        ),
        need_reservations=True,
    )
    return Response({
        'ok': True,
        'message': 'Demande envoyée à l’hôtel. Vous serez notifié de la décision.',
        'reschedule_status': res.reschedule_status,
        'preferred_check_in': str(pref_in),
        'preferred_check_out': str(pref_out),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsHotelStaff])
def staff_directory(request):
    """Agents assignables (HK / staff hôtel)."""
    hotel = _hotel(request)
    from businesses.models import BusinessEmployee
    emps = BusinessEmployee.objects.filter(business=hotel, is_active=True).select_related('user', 'role')
    return Response([
        {
            'id': str(e.user_id),
            'email': e.user.email,
            'name': f'{e.user.first_name} {e.user.last_name}'.strip() or e.user.email,
            'role_name': e.role.name if e.role else e.position,
        }
        for e in emps
    ])
