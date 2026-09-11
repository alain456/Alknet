from django.conf import settings
from django.core.mail import send_mail
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from businesses.models import BusinessEmployee
from .models import Booking
from .serializers import BookingSerializer


def _business_staff(user, business):
    if user.role == 'BUSINESS_OWNER' and getattr(business, 'owner_id', None) == user.id:
        return True
    return BusinessEmployee.objects.filter(
        user=user, business=business, is_active=True
    ).exists()


def _notify_booking_client(booking, *, subject, body):
    recipient = (getattr(booking.customer, 'email', None) or '').strip()
    if not recipient:
        return {'status': 'FAILED', 'error': 'Aucun email client'}
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient],
            fail_silently=False,
        )
        return {'status': 'SENT', 'recipient': recipient}
    except Exception as exc:
        return {'status': 'FAILED', 'recipient': recipient, 'error': str(exc)}


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Booking.objects.select_related('customer', 'business', 'service')

        if user.role == 'SUPER_ADMIN':
            return Booking.objects.none()
        elif user.role == 'BUSINESS_OWNER':
            queryset = queryset.filter(business__owner=user)
        elif BusinessEmployee.objects.filter(user=user, is_active=True).exists():
            queryset = queryset.filter(business__employees__user=user)
        else:
            queryset = queryset.filter(customer=user)

        business_id = self.request.query_params.get('business')
        status_param = self.request.query_params.get('status')
        upcoming = self.request.query_params.get('upcoming')

        if business_id:
            queryset = queryset.filter(business_id=business_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if upcoming and upcoming.lower() in ('true', '1'):
            from django.utils import timezone
            queryset = queryset.filter(scheduled_date__gte=timezone.now())

        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        if booking.status in ('COMPLETED', 'CANCELLED'):
            return Response({'error': 'Ce booking ne peut pas être annulé.'}, status=400)
        by_business = _business_staff(request.user, booking.business)
        booking.status = 'CANCELLED'
        booking.save(update_fields=['status', 'updated_at'])
        data = BookingSerializer(booking).data
        if by_business and booking.customer_id != request.user.id:
            biz = booking.business.name if booking.business_id else 'l\'établissement'
            when = booking.scheduled_date.strftime('%d/%m/%Y à %H:%M') if booking.scheduled_date else '—'
            data['email_notification'] = _notify_booking_client(
                booking,
                subject=f'[Isoko Hub] Réservation annulée — {biz}',
                body=(
                    f'Bonjour {booking.customer.get_full_name() or "Client"},\n\n'
                    f'Votre réservation chez {biz} prévue le {when} a été annulée.\n\n'
                    f'— Isoko Hub\n'
                ),
            )
        return Response(data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        if not _business_staff(user, booking.business):
            return Response({'error': 'Permission refusée.'}, status=403)
        booking.status = 'CONFIRMED'
        booking.save(update_fields=['status', 'updated_at'])
        biz = booking.business.name if booking.business_id else 'l\'établissement'
        when = booking.scheduled_date.strftime('%d/%m/%Y à %H:%M') if booking.scheduled_date else '—'
        data = BookingSerializer(booking).data
        data['email_notification'] = _notify_booking_client(
            booking,
            subject=f'[Isoko Hub] Réservation confirmée — {biz}',
            body=(
                f'Bonjour {booking.customer.get_full_name() or "Client"},\n\n'
                f'Votre réservation chez {biz} prévue le {when} a été confirmée.\n\n'
                f'— Isoko Hub\n'
            ),
        )
        return Response(data)
