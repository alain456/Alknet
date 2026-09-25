"""Résolution de tarifs + alertes ops (manquements config côté hôtel)."""
from __future__ import annotations

import logging
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

logger = logging.getLogger(__name__)


def hotel_ops_recipients(hotel, *, need_rates=False, need_reservations=False):
    """Propriétaire + managers / agents concernés."""
    from businesses.models import BusinessEmployee
    from .permission_catalog import hotel_perm
    from .permissions import effective_hotel_permissions

    recipients = []
    seen = set()

    def _add(user):
        if user and user.id not in seen:
            seen.add(user.id)
            recipients.append(user)

    if getattr(hotel, 'owner_id', None):
        _add(hotel.owner)

    emps = (
        BusinessEmployee.objects.filter(business=hotel, is_active=True)
        .select_related('user', 'role')
    )
    for emp in emps:
        user = emp.user
        if not user:
            continue
        eff = effective_hotel_permissions(user, hotel)
        is_mgr = 'hotel.manage' in eff or '*' in eff
        is_rates = (
            hotel_perm('rates', 'view') in eff
            or hotel_perm('rates', 'create') in eff
            or hotel_perm('rates', 'update') in eff
        )
        is_res = (
            'hotel.reservations' in eff
            or hotel_perm('reservations', 'view') in eff
            or hotel_perm('reservations', 'create') in eff
        )
        if is_mgr:
            _add(user)
        elif need_rates and is_rates:
            _add(user)
        elif need_reservations and is_res:
            _add(user)
    return recipients


def notify_hotel_ops(hotel, title: str, message: str, *, need_rates=False, need_reservations=False) -> dict:
    """Email + notification in-app pour les acteurs ops."""
    leads = hotel_ops_recipients(
        hotel, need_rates=need_rates, need_reservations=need_reservations,
    )
    if not leads:
        return {'ok': False, 'sent': False, 'in_app': 0, 'emails': [], 'error': 'Aucun destinataire ops.'}

    hotel_name = hotel.name or 'Hôtel'
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'noreply@isokohub.bi'
    emails_sent = []
    for user in leads:
        email = (getattr(user, 'email', None) or '').strip()
        if not email:
            continue
        try:
            send_mail(
                subject=f'[Isoko Hub] {title} — {hotel_name}',
                message=(
                    f'Bonjour {user.first_name or user.email},\n\n'
                    f'{message}\n\n'
                    f'— {hotel_name} via Isoko Hub\n'
                ),
                from_email=from_email,
                recipient_list=[email],
                fail_silently=False,
            )
            emails_sent.append(email)
        except Exception:
            logger.exception('Email ops hôtel échoué pour %s', email)

    in_app = 0
    try:
        from hospital.models import Notification
        for user in leads:
            Notification.objects.create(
                user=user,
                notification_type='GENERAL',
                title=title,
                message=message[:500],
            )
            in_app += 1
    except Exception:
        logger.exception('Notification in-app ops hôtel échouée')

    return {
        'ok': bool(emails_sent) or in_app > 0,
        'sent': bool(emails_sent),
        'in_app': in_app,
        'emails': emails_sent,
        'recipients_count': len(leads),
    }


@transaction.atomic
def resolve_rate_plan(hotel, room_type, *, auto_create=True, notify=True):
    """
    Retourne un RatePlan actif pour le type.
    Si aucun tarif : crée un tarif « Standard » depuis room_type.base_price (> 0)
    et notifie le manager / agent tarifs.
    """
    from .models import RatePlan

    rate = (
        RatePlan.objects.filter(hotel=hotel, room_type=room_type, is_active=True)
        .order_by('price_per_night')
        .first()
    )
    if rate:
        return rate, {'created': False, 'notified': False}

    base = Decimal(str(getattr(room_type, 'base_price', None) or 0))
    if not auto_create or base <= 0:
        if notify:
            notify_hotel_ops(
                hotel,
                title=f'Tarif manquant — {room_type.name}',
                message=(
                    f'Un client tente de réserver « {room_type.name} » mais aucun tarif actif '
                    f'n’est configuré (et le prix de base du type est vide ou à 0).\n'
                    f'Action : créez un tarif dans le menu Tarifs pour ce type de chambre.'
                ),
                need_rates=True,
                need_reservations=True,
            )
        return None, {'created': False, 'notified': bool(notify), 'reason': 'no_price'}

    currency = 'BIF'
    try:
        currency = getattr(hotel.hotel_profile, 'currency', None) or 'BIF'
    except Exception:
        pass

    rate = RatePlan.objects.create(
        hotel=hotel,
        room_type=room_type,
        name='Standard',
        rate_kind='STANDARD',
        price_per_night=base,
        currency=currency,
        is_active=True,
    )
    notified = False
    if notify:
        result = notify_hotel_ops(
            hotel,
            title=f'Tarif auto-créé — {room_type.name}',
            message=(
                f'Aucun tarif n’existait pour « {room_type.name} ». '
                f'Le système a créé un tarif Standard à {base} {currency}/nuit '
                f'(depuis le prix de base du type).\n'
                f'Verifiez / ajustez dans le menu Tarifs si besoin.'
            ),
            need_rates=True,
            need_reservations=True,
        )
        notified = bool(result.get('ok'))
    return rate, {'created': True, 'notified': notified, 'price': str(base)}


def synthetic_rates_for_public(hotel, room_types, existing_rates):
    """
    Pour l’API publique : si un type n’a aucun tarif actif mais a un base_price > 0,
    expose un tarif virtuel (id = type) pour l’UI client. Le backend résoudra au book.
    """
    from .serializers import RatePlanSerializer

    covered = {str(r.room_type_id) for r in existing_rates}
    out = list(RatePlanSerializer(existing_rates, many=True).data)
    currency = 'BIF'
    try:
        currency = getattr(hotel.hotel_profile, 'currency', None) or 'BIF'
    except Exception:
        pass

    for rt in room_types:
        tid = str(rt.id)
        if tid in covered:
            continue
        base = Decimal(str(rt.base_price or 0))
        if base <= 0:
            continue
        out.append({
            'id': f'base:{tid}',
            'hotel': str(hotel.id),
            'room_type': tid,
            'room_type_name': rt.name,
            'name': 'Standard',
            'rate_kind': 'STANDARD',
            'price_per_night': str(base),
            'currency': currency,
            'valid_from': None,
            'valid_to': None,
            'min_nights': 1,
            'includes_breakfast': False,
            'taxes_included': False,
            'cancellation_policy': '',
            'is_active': True,
            'is_synthetic': True,
        })
    return out
