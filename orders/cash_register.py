"""Caisse : enregistrement des encaissements et suivi de l'argent.

RetailOrder.payment_status / WholesaleOrder.payment_status décrivent l'état
d'une commande, pas l'argent. Ce module écrit une ligne CashCollection par
encaissement réel et fournit les agrégats du tableau de bord.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from .models import CashCollection


def _business_of(order):
    """Retourne le Business et l'app source d'un objet retail ou wholesale."""
    if hasattr(order, 'retail_business'):
        return order.retail_business, CashCollection.SOURCE_RETAIL
    if hasattr(order, 'wholesale_business'):
        return order.wholesale_business, CashCollection.SOURCE_WHOLESALE
    raise TypeError(f'Objet non pris en charge par la caisse : {type(order).__name__}')


def _customer_name(order) -> str:
    return (
        getattr(order, 'patient_name', '')
        or getattr(order, 'buyer_name', '')
        or getattr(order, 'customer_name', '')
        or ''
    )[:120]


def record_collection(
    order,
    amount,
    method: str = 'CASH',
    received_by=None,
    external_reference: str = '',
    status: str = 'COLLECTED',
    note: str = '',
) -> dict:
    """Enregistre un encaissement. Idempotent sur external_reference.

    Revenir avec la même external_reference ne crée pas de seconde ligne :
    c'est la protection contre le double comptage lors d'un double callback
    de paiement ou d'un double enregistrement par le caissier.
    """
    business, source = _business_of(order)
    external_reference = (external_reference or '').strip()
    amount = Decimal(str(amount or '0'))

    if amount <= 0:
        return {'ok': False, 'created': False, 'message': 'Montant nul ou négatif.'}

    existing = CashCollection.objects.filter(
        source=source,
        source_object_id=order.id,
        external_reference=external_reference,
    ).first() if external_reference else None
    if existing:
        return {
            'ok': True, 'created': False, 'collection': existing,
            'message': 'Encaissement déjà enregistré.',
        }

    try:
        with transaction.atomic():
            collection = CashCollection.objects.create(
                business=business,
                source=source,
                source_order=ContentType.objects.get_for_model(order),
                source_object_id=order.id,
                source_order_ref=(getattr(order, 'reference', '') or '')[:40],
                amount=amount,
                currency=getattr(order, 'currency', 'BIF') or 'BIF',
                method=method,
                status=status,
                external_reference=external_reference[:120],
                customer_name=_customer_name(order),
                note=note,
                received_by=received_by,
            )
    except IntegrityError:
        # Course perdue : un autre enregistrement a gagné, on renvoie l'existant.
        existing = CashCollection.objects.filter(
            source=source, source_object_id=order.id, external_reference=external_reference,
        ).first()
        if existing:
            return {
                'ok': True, 'created': False, 'collection': existing,
                'message': 'Encaissement déjà enregistré.',
            }
        raise

    return {
        'ok': True, 'created': True, 'collection': collection,
        'message': 'Encaissement enregistré.',
    }


def record_refund(order, amount, received_by=None, note: str = '') -> dict:
    """Rembourse une commande. Écrit une ligne négative, ne modifie rien d'existant."""
    return record_collection(
        order, amount, method='CASH', received_by=received_by,
        status='REFUNDED', note=note or 'Remboursement',
    )


def collected_total(order) -> Decimal:
    return CashCollection.objects.filter(
        source_order=ContentType.objects.get_for_model(order),
        source_object_id=order.id,
    ).aggregate(s=Sum('amount'))['s'] or Decimal('0')


def _range(business, since, until, source: str = ''):
    qs = CashCollection.objects.filter(business=business, collected_at__gte=since)
    if until:
        qs = qs.filter(collected_at__lt=until)
    if source:
        qs = qs.filter(source=source)
    return qs


def cash_dashboard(business, since=None, until=None) -> dict:
    """Totaux encaissés par méthode, pour la période demandée.

    Les remboursés sortent du total (signed_amount) : la caisse contient ce
    qui est réellement dedans, pas ce qui est entré puis ressorti.
    """
    since = since or timezone.now() - timedelta(days=30)
    until = until or timezone.now() + timedelta(days=1)
    qs = _range(business, since, until)

    by_method = {}
    for row in qs.values('method', 'status').annotate(
        total=Sum('amount'), n=Count('id'),
    ):
        sign = -1 if row['status'] == 'REFUNDED' else 1
        entry = by_method.setdefault(row['method'], {'amount': Decimal('0'), 'count': 0})
        entry['amount'] += sign * row['total']
        entry['count'] += row['n']

    refunds = qs.filter(status='REFUNDED').aggregate(s=Sum('amount'))['s'] or Decimal('0')
    total = sum((e['amount'] for e in by_method.values()), Decimal('0'))
    cash = by_method.get('CASH', {}).get('amount', Decimal('0'))

    return {
        'total_collected': total,
        'cash_on_hand': cash,
        'refunded_total': refunds,
        'by_method': {
            k: {'amount': v['amount'], 'count': v['count']} for k, v in by_method.items()
        },
        'since': since,
        'until': until,
    }


def _orders_pending_payment(business, source, today_only=True):
    """Commandes marquées payées mais sans ligne d'encaissement correspondante.

    C'est l'incohérence que la caisse sert à faire remonter : le statut de la
    commande affirme un paiement que la caisse n'a jamais vu.
    """
    from retail.models import RetailOrder
    from wholesale.models import WholesaleOrder

    model = RetailOrder if source == CashCollection.SOURCE_RETAIL else WholesaleOrder
    fk = 'retail_business' if source == CashCollection.SOURCE_RETAIL else 'wholesale_business'
    qs = model.objects.filter(**{fk: business, 'payment_status': 'PAID'})
    if today_only:
        qs = qs.filter(paid_at__date=timezone.localdate())

    recorded = set(
        CashCollection.objects
        .filter(source=source, source_object_id__in=list(qs.values_list('id', flat=True)))
        .values_list('source_object_id', flat=True)
    )
    return [o for o in qs if o.id not in recorded]


def detect_reconciliation(business, days: int = 7) -> dict:
    """Compare ce que les commandes affirment avoir payé et ce que la caisse a vu."""
    anomalies = []
    for source in (CashCollection.SOURCE_RETAIL, CashCollection.SOURCE_WHOLESALE):
        for order in _orders_pending_payment(business, source, today_only=False):
            anomalies.append({
                'type': 'PAID_WITHOUT_COLLECTION',
                'source': source,
                'order_id': str(order.id),
                'reference': order.reference or str(order.id),
                'amount': order.total_amount,
                'message': 'Commande marquée payée sans encaissement enregistré.',
            })

    since = timezone.now() - timedelta(days=days)
    refunds = CashCollection.objects.filter(
        business=business, status='REFUNDED', collected_at__gte=since,
    )
    for refund in refunds:
        if refund.amount > collected_total_for_order(refund):
            anomalies.append({
                'type': 'REFUND_EXCEEDS_TOTAL',
                'source': refund.source,
                'order_id': str(refund.source_object_id),
                'reference': refund.source_order_ref,
                'amount': refund.amount,
                'message': 'Remboursement supérieur au total encaissé.',
            })

    return {
        'anomalies': anomalies,
        'count': len(anomalies),
        'clean': not anomalies,
        'since': since,
    }


def collected_total_for_order(refund: CashCollection) -> Decimal:
    return CashCollection.objects.filter(
        source=refund.source, source_object_id=refund.source_object_id,
    ).exclude(status='REFUNDED').aggregate(s=Sum('amount'))['s'] or Decimal('0')


def record_order_payment(
    order,
    method: str = '',
    received_by=None,
    external_reference: str = '',
    note: str = '',
) -> dict | None:
    """Enregistre l'encaissement quand une commande passe à PAID.

    À appeler depuis les points où une commande devient payée, pour que tout
    l'argent entre dans la caisse quel que soit le chemin emprunté (BurundiPay
    ou règlement espèces saisi au comptoir). Les commandes à montant nul
    n'entrent pas : il n'y a rien à suivre.

    Ne lève jamais : une erreur de caisse ne doit pas faire échouer un
    paiement déjà validé par le fournisseur.
    """
    try:
        amount = Decimal(str(getattr(order, 'total_amount', 0) or '0'))
        if amount <= 0:
            return None
        return record_collection(
            order,
            amount,
            method=(method or getattr(order, 'payment_method', '') or 'CASH').upper(),
            received_by=received_by,
            external_reference=(
                external_reference or getattr(order, 'payment_provider_reference', '') or ''
            ),
            note=note,
        )
    except Exception:
        return None
