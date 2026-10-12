"""API caisse : suivre l'argent encaissé par une pharmacie.

Sert les deux types de pharmacie. Le détail et le gros partagent ce module :
même journal, mêmes agrégats, mêmes écarts. Un seul jeu d'écritures à
entretenir, et pas de divergence entre les deux activity types.

Le journal d'encaissements est la source de vérité. Les agrégats sont calculés
dessus, jamais sur RetailOrder.payment_status, qui ne dit rien de l'argent
réellement reçu.
"""
from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response

from orders.cash_register import cash_dashboard, detect_reconciliation
from orders.models import CashCollection

from .cash_serializers import (
    CashCollectionSerializer, CashDashboardSerializer,
    CashReconciliationSerializer,
)
from businesses.tenant import get_user_tenant_business

from .permissions import is_retail_pharmacy
from .views import _admin_business
from wholesale.views import is_wholesale_business

METHOD_LABELS = dict(CashCollection.METHOD_CHOICES)
SOURCE_LABELS = dict(CashCollection.SOURCE_CHOICES)


def _parse_range(request):
    """Bornes de la période demandée. Par défaut : les 30 derniers jours."""
    now = timezone.now()
    try:
        days = int(request.query_params.get('days', 30))
    except (TypeError, ValueError):
        days = 30
    days = max(1, min(days, 365))
    return now - timedelta(days=days), now


def _resolve_cash_business(request):
    """Résout l'entreprise de l'appelant, détail comme gros.

    is_retail_pharmacy exclut volontairement les grossistes : on ne peut donc
    pas réutiliser le résolveur retail. On vérifie ici qu'il s'agit bien d'une
    pharmacie (l'un ou l'autre type) et que l'appelant en est le propriétaire.
    """
    business = get_user_tenant_business(request.user)
    if not business:
        return None
    if business.owner_id != getattr(request.user, 'id', None):
        return None
    if not (is_retail_pharmacy(business) or is_wholesale_business(business)):
        return None
    return business


def _cash_registration(request):
    """Résout l'entreprise de l'appelant et construit l'erreur 403 sinon."""
    business = _resolve_cash_business(request)
    if not business:
        return None, Response(
            {
                'detail': (
                    "Accès réservé à l'administrateur d'une pharmacie de détail "
                    "ou de gros."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return business, None


def _cash_source_for(business):
    """Détermine quel type de commande lire selon l'entreprise."""
    return (
        CashCollection.SOURCE_WHOLESALE
        if is_wholesale_business(business)
        else CashCollection.SOURCE_RETAIL
    )


def _order_model_for(business):
    """Modèle de commande, FK métier et champ nom client, selon le type.

    Détail : RetailOrder / retail_business / patient_name.
    Gros   : WholesaleOrder / wholesale_business / buyer_name.
    """
    if is_wholesale_business(business):
        from wholesale.models import WholesaleOrder
        return WholesaleOrder, 'wholesale_business', 'buyer_name'
    from .models import RetailOrder
    return RetailOrder, 'retail_business', 'patient_name' 


class CashRegisterViewSet(viewsets.ReadOnlyModelViewSet):
    """Suivi de la caisse. L'écriture passe par les workflows de commande."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CashCollectionSerializer

    def get_queryset(self):
        business, error = _cash_registration(self.request)
        if error:
            # Refus explicite plutôt qu'une liste vide : un 403 est sans
            # ambiguïté pour le client, et évite qu'un jour une queryset
            # trop large fuite par megot.
            raise PermissionDenied(
                "Accès réservé à l'administrateur d'une pharmacie ou d'un grossiste."
            )
        qs = CashCollection.objects.filter(business=business).select_related('received_by')
        if self.request.query_params.get('source'):
            qs = qs.filter(source=self.request.query_params['source'])
        if self.request.query_params.get('method'):
            qs = qs.filter(method=self.request.query_params['method'])
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Totaux encaissés par méthode sur la période."""
        business, error = _cash_registration(request)
        if error:
            return error
        since, until = _parse_range(request)

        data = cash_dashboard(business, since=since, until=until)
        by_method = [
            {
                'method': method,
                'label': METHOD_LABELS.get(method, method),
                'amount': totals['amount'],
                'count': totals['count'],
            }
            for method, totals in sorted(
                data['by_method'].items(), key=lambda kv: kv[1]['amount'], reverse=True,
            )
        ]
        payload = {
            'total_collected': data['total_collected'],
            'cash_on_hand': data['cash_on_hand'],
            'refunded_total': data['refunded_total'],
            'by_method': by_method,
            'currency': 'BIF',
            'since': since,
            'until': until,
        }
        return Response(CashDashboardSerializer(payload).data)

    @action(detail=False, methods=['get'])
    def reconciliation(self, request):
        """Écarts entre statuts de commande et encaissements réels."""
        business, error = _cash_registration(request)
        if error:
            return error
        try:
            days = int(request.query_params.get('days', 30))
        except (TypeError, ValueError):
            days = 30
        report = detect_reconciliation(business, days=max(1, min(days, 365)))
        payload = {
            'clean': report['clean'],
            'count': report['count'],
            'anomalies': report['anomalies'],
            'since': report['since'],
        }
        return Response(CashReconciliationSerializer(payload).data)

    @action(detail=False, methods=['get'], url_path='missing-collections')
    def missing_collections(self, request):
        """Commandes marquées payées dont l'argent manque à la caisse.

        Le paiement se fait par BurundiPay et l'encaissement s'enregistre
        automatiquement quand il aboutit. Cette liste ne sert donc pas à
        saisir un règlement : elle signale les commandes où la commande
        affirme un paiement que la caisse n'a jamais vu, et permet d'en
        enregistrer la ligne manquante.
        """
        business, error = _cash_registration(request)
        if error:
            return error

        from orders.cash_register import collected_total

        model, fk, name_field = _order_model_for(business)
        qs = (
            model.objects
            .filter(**{fk: business, 'payment_status': 'PAID'})
            .exclude(status__in=('CANCELLED', 'REJECTED'))
            .order_by('-paid_at')[:100]
        )
        rows = []
        for order in qs:
            recorded = collected_total(order)
            expected = order.total_amount or 0
            if expected > 0 and recorded >= expected:
                continue
            rows.append({
                'order_id': str(order.id),
                'reference': order.reference,
                'customer_name': getattr(order, name_field, '') or '',
                'total_amount': expected,
                'collected': recorded,
                'balance': expected - recorded,
                'method': order.payment_method or 'BURUNDIPAY',
                'provider_reference': order.payment_provider_reference or '',
                'paid_at': order.paid_at,
            })
        return Response({
            'count': len(rows),
            'total_remaining': sum((r['balance'] for r in rows), 0),
            'orders': rows,
        })

    @action(detail=False, methods=['post'], url_path='record-missing')
    def record_missing(self, request):
        """Enregistre l'encaissement d'une commande payée sans ligne de caisse.

        Ne s'applique qu'à une commande déjà payée : la commande n'est pas
        modifiée, seule la caisse est complétée. Une commande déjà enregistrée
        est refusée, ce qui empêche de compter deux fois le même argent.
        """
        business, error = _cash_registration(request)
        if error:
            return error

        from orders.cash_register import collected_total, record_collection

        model, fk, _ = _order_model_for(business)
        order = model.objects.filter(
            id=request.data.get('order_id'), **{fk: business},
        ).select_related(fk).first()
        if not order:
            return Response(
                {'detail': 'Commande introuvable pour cette pharmacie.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if order.payment_status != 'PAID':
            return Response(
                {
                    'detail': (
                        "Cette commande n'est pas marquée payée : aucun encaissement "
                        "à enregistrer."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = order.total_amount or 0
        already = collected_total(order)
        if amount > 0 and already >= amount:
            return Response(
                {
                    'detail': (
                        f"Encaissement déjà enregistré pour {order.reference}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = record_collection(
            order,
            amount,
            method=order.payment_method or 'BURUNDIPAY',
            received_by=request.user,
            external_reference=order.payment_provider_reference or '',
            note='Encaissement régularisé',
        )
        return Response({
            'ok': True,
            'order_id': str(order.id),
            'reference': order.reference,
            'collected': collected_total(order),
            'created': result['created'],
            'message': 'Encaissement enregistré.',
        })

    # ═══ Exports ═══════════════════════════════════════════════════
    #
    # Un export doit dire exactement ce que dit l'écran : mêmes données,
    # même filtrage, même périmètre. Il passe donc par cash_dashboard et
    # non par une requête parallèle qui dériverait.

    def _export_data(self, request, business):
        """Construit le jeu de données commun à tous les exports."""
        from orders.cash_register import cash_dashboard, collected_total

        since, until = _parse_range(request)
        dashboard = cash_dashboard(business, since=since, until=until)

        # Le journal ne suit pas la période des agrégats : un journal
        # tronqué à la période choisie serait trompeur, on exporte l'historique.
        journal = list(
            CashCollection.objects.filter(business=business)
            .select_related('received_by')[:2000]
        )

        model, fk, name_field = _order_model_for(business)
        missing = []
        for order in (
            model.objects.filter(**{fk: business, 'payment_status': 'PAID'})
            .exclude(status__in=('CANCELLED', 'REJECTED'))
            .order_by('-paid_at')[:500]
        ):
            expected = order.total_amount or 0
            recorded = collected_total(order)
            if expected > 0 and recorded >= expected:
                continue
            missing.append({
                'reference': order.reference,
                'customer_name': getattr(order, name_field, '') or '',
                'method': order.payment_method or 'BurundiPay',
                'provider_reference': order.payment_provider_reference or '',
                'paid_at': order.paid_at,
                'total_amount': expected,
                'collected': recorded,
            })
        return dashboard, journal, missing

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export Excel (.xlsx) ou CSV.

        Paramètres : ?filetype=excel|csv et ?report=journal|missing|both.

        Le paramètre s'appelle filetype et non format : « format » est réservé
        par DRF pour la négociation de contenu, et ?format=csv provoquerait
        un 404 en cherchant un renderer inexistant.
        """
        business, error = _cash_registration(request)
        if error:
            return error

        from django.http import HttpResponse
        from orders.cash_export import (
            JOURNAL_COLUMNS, MISSING_COLUMNS, build_csv, build_workbook,
            journal_rows, missing_rows,
        )

        fmt = (request.query_params.get('filetype') or 'excel').lower()
        report = (request.query_params.get('report') or 'both').lower()
        if fmt not in ('excel', 'csv') or report not in ('journal', 'missing', 'both'):
            return Response(
                {
                    'detail': (
                        "Paramètres invalides. filetype=excel|csv, "
                        "report=journal|missing|both."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        dashboard, journal, missing = self._export_data(request, business)
        stamp = datetime.now().strftime('%Y%m%d-%H%M')

        if fmt == 'csv':
            # Le CSV ne peut pas contenir deux feuilles : une requête, un
            # rapport. « both » tombe sur le journal, le plus volumineux.
            use_journal = report != 'missing'
            columns = JOURNAL_COLUMNS if use_journal else MISSING_COLUMNS
            rows = journal_rows(journal) if use_journal else missing_rows(missing)
            title = (
                f'Journal des encaissements — {business.name}'
                if use_journal else f'Encaissements manquants — {business.name}'
            )
            label = 'journal' if use_journal else 'encaissements-manquants'
            payload = build_csv(title, columns, rows)
            response = HttpResponse(payload, content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = (
                f'attachment; filename="caisse-{label}-{stamp}.csv"'
            )
            return response

        payload = build_workbook(business.name, journal, missing, dashboard)
        response = HttpResponse(
            payload,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        slug = 'gros' if is_wholesale_business(business) else 'detail'
        response['Content-Disposition'] = (
            f'attachment; filename="caisse-{slug}-{stamp}.xlsx"'
        )
        return response
