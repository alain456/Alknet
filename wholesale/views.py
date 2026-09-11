from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from businesses.models import Business
from businesses.tenant import get_user_tenant_business
from .models import (
    WholesalePharmacyProfile, WholesaleProduct, StockMovement,
    WholesaleOrder, WholesaleOrderItem, WholesaleCart, WholesaleCartItem,
    ProformaInvoice,
)
from .serializers import (
    WholesaleProfileSerializer, WholesaleProductSerializer, WholesaleProductPublicSerializer,
    StockMovementSerializer, WholesaleOrderSerializer, WholesaleCartSerializer,
    ProformaInvoiceSerializer,
)
from .order_workflow import (
    ensure_wholesale_profile, generate_order_reference, log_order_event,
    recalculate_order_total, adjust_stock, accept_order, reject_order,
    mark_order_paid, mark_order_unpaid, REFUSAL_REASONS,
    snapshot_cart_item, sync_draft_proforma, generate_proforma_reference,
)


def _cat_name(business):
    return (getattr(business.primary_category, 'name', None) or '').lower()


def is_wholesale_business(business):
    name = _cat_name(business)
    return 'pharmacie de gros' in name or ('gros' in name and 'pharmac' in name)


def is_retail_pharmacy(business):
    name = _cat_name(business)
    if 'pharmacie de gros' in name:
        return False
    return (
        'pharmacie de detail' in name
        or 'pharmacie de détail' in name
        or name.strip() == 'pharmacie'
        or ('pharmac' in name and ('detail' in name or 'détail' in name or 'officine' in name))
    )


def _lumicash_payment_from_request(data):
    from businesses.lumicash import normalize_phone

    method = (data.get('payment_method') or 'LUMICASH').strip().upper() or 'LUMICASH'
    raw_phone = (
        data.get('payer_phone')
        or data.get('lumicash_phone')
        or data.get('payer_lumicash')
        or ''
    ).strip()
    if method != 'LUMICASH':
        return method, raw_phone[:40], None
    if not raw_phone:
        return None, None, 'Indiquez votre numéro Lumicash pour le paiement.'
    phone = normalize_phone(raw_phone)
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) < 8:
        return None, None, 'Numéro Lumicash invalide.'
    return 'LUMICASH', phone[:40], None


class WholesaleProfileViewSet(viewsets.ModelViewSet):
    serializer_class = WholesaleProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        business = get_user_tenant_business(self.request.user)
        if not business:
            return WholesalePharmacyProfile.objects.none()
        return WholesalePharmacyProfile.objects.filter(business=business)

    def list(self, request, *args, **kwargs):
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucune entreprise.'}, status=400)
        profile = ensure_wholesale_profile(business)
        return Response(self.get_serializer(profile).data)

    def _update_profile(self, request):
        business = get_user_tenant_business(request.user)
        if not business or business.owner_id != request.user.id:
            return Response({'error': 'Permission refusee.'}, status=403)
        if not is_wholesale_business(business):
            return Response({'error': 'Pharmacie de gros requise.'}, status=403)
        profile = ensure_wholesale_profile(business)
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        b_fields = {}
        for src in ('phone', 'email', 'address', 'description'):
            if src in request.data:
                b_fields[src] = request.data[src]
        if b_fields:
            for k, v in b_fields.items():
                setattr(business, k, v)
            business.save(update_fields=list(b_fields.keys()) + ['updated_at'])
        return Response(self.get_serializer(profile).data)

    def partial_update(self, request, *args, **kwargs):
        return self._update_profile(request)

    @action(detail=False, methods=['patch', 'put'])
    def me(self, request):
        return self._update_profile(request)


class WholesaleProductViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_authenticators(self):
        # Évite le 401 quand un JWT expiré est envoyé sur le catalogue public.
        # Note: self.request est encore un WSGIRequest ici (pas encore DRF Request).
        public = self.request.GET.get('public', '').lower() in ('1', 'true')
        if public and self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return []
        return super().get_authenticators()

    def get_permissions(self):
        public = self.request.query_params.get('public', '').lower() in ('1', 'true')
        if self.action in ('list', 'retrieve') and public:
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_serializer_class(self):
        business = get_user_tenant_business(self.request.user)
        if business and is_wholesale_business(business) and business.owner_id == self.request.user.id:
            return WholesaleProductSerializer
        return WholesaleProductPublicSerializer

    def get_queryset(self):
        user = self.request.user
        business = get_user_tenant_business(user)
        qs = WholesaleProduct.objects.select_related('wholesale_business')
        wholesale_id = self.request.query_params.get('wholesale')
        public = self.request.query_params.get('public', '').lower() in ('1', 'true')

        if wholesale_id and (public or (business and is_retail_pharmacy(business))):
            return qs.filter(
                wholesale_business_id=wholesale_id,
                status='ACTIVE',
                wholesale_business__is_active=True,
                wholesale_business__is_verified=True,
                wholesale_business__verification_status='APPROVED',
            )

        if public:
            return qs.filter(
                status='ACTIVE',
                wholesale_business__is_active=True,
                wholesale_business__is_verified=True,
                wholesale_business__verification_status='APPROVED',
            )

        if business and is_wholesale_business(business):
            return qs.filter(wholesale_business=business)

        if business and is_retail_pharmacy(business):
            return qs.filter(status='ACTIVE')

        return qs.none()

    def perform_create(self, serializer):
        business = get_user_tenant_business(self.request.user)
        if not business or not is_wholesale_business(business):
            raise permissions.PermissionDenied('Pharmacie de gros requise.')
        ensure_wholesale_profile(business)
        serializer.save(wholesale_business=business)

    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        business = get_user_tenant_business(request.user)
        if not business or product.wholesale_business_id != business.id:
            return Response({'error': 'Permission refusee.'}, status=403)
        new_qty = request.data.get('quantity_real')
        reason = request.data.get('reason') or 'Ajustement manuel'
        if new_qty is None:
            return Response({'error': 'quantity_real requis'}, status=400)
        adjust_stock(product, int(new_qty), reason, user=request.user)
        return Response(WholesaleProductSerializer(product).data)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        qs = self.get_queryset().filter(status='ACTIVE')
        items = [p for p in qs if p.stock_status in ('LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED')]
        return Response(WholesaleProductSerializer(items, many=True).data)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        business = get_user_tenant_business(self.request.user)
        if not business:
            return StockMovement.objects.none()
        return StockMovement.objects.filter(
            product__wholesale_business=business
        ).select_related('product', 'user')


class WholesaleOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WholesaleOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if getattr(self, 'action', None) in ('pay', 'confirm_payment'):
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, 'action', None) in ('pay', 'confirm_payment'):
            return WholesaleOrder.objects.select_related(
                'client_business', 'wholesale_business', 'created_by', 'proforma'
            ).prefetch_related('items')

        business = get_user_tenant_business(self.request.user)
        if not business:
            return WholesaleOrder.objects.none()
        qs = WholesaleOrder.objects.select_related(
            'client_business', 'wholesale_business', 'created_by', 'proforma'
        ).prefetch_related('items', 'events', 'notification_logs')
        if is_wholesale_business(business):
            qs = qs.filter(wholesale_business=business)
        elif is_retail_pharmacy(business):
            qs = qs.filter(client_business=business)
        else:
            return qs.none()

        params = self.request.query_params
        status_filter = params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        client_id = params.get('client')
        if client_id:
            qs = qs.filter(client_business_id=client_id)
        buyer_email = (params.get('buyer_email') or '').strip()
        if buyer_email:
            from django.db.models import Q
            qs = qs.filter(
                Q(buyer_email__iexact=buyer_email) | Q(notification_email__iexact=buyer_email)
            )
        q = (params.get('q') or '').strip()
        if q:
            qs = qs.filter(reference__icontains=q)
        date_from = params.get('date_from')
        date_to = params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        min_amount = params.get('min_amount')
        max_amount = params.get('max_amount')
        if min_amount:
            qs = qs.filter(total_amount__gte=min_amount)
        if max_amount:
            qs = qs.filter(total_amount__lte=max_amount)

        # Prioriser Envoyée / En cours
        from django.db.models import Case, When, IntegerField
        return qs.annotate(
            _prio=Case(
                When(status='SUBMITTED', then=0),
                When(status='PROCESSING', then=1),
                default=2,
                output_field=IntegerField(),
            )
        ).order_by('_prio', '-created_at')

    @action(detail=False, methods=['get'])
    def refusal_reasons(self, request):
        return Response(REFUSAL_REASONS)

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        from businesses import lumicash as lumicash_client
        from .order_payment import initiate_order_payment

        order = self.get_object()
        payer_phone = (
            request.data.get('payer_phone')
            or request.data.get('phone')
            or order.payer_phone
            or ''
        ).strip()
        if not payer_phone:
            return Response({'error': 'payer_phone (Lumicash) requis.'}, status=400)
        result = initiate_order_payment(order, payer_phone)
        order.refresh_from_db()
        data = self.get_serializer(order).data
        return Response({
            'ok': result.get('ok'),
            'already_paid': result.get('already_paid', False),
            'message': result.get('message') or '',
            'stub_mode': result.get('stub_mode', lumicash_client.is_stub_mode()),
            'amount_bif': result.get('amount_bif'),
            'currency': result.get('currency'),
            'merchant_account': result.get('merchant_account'),
            'provider_reference': result.get('provider_reference'),
            'order': data,
        }, status=200 if result.get('ok') else 400)

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        from .order_payment import confirm_order_payment_stub

        order = self.get_object()
        result = confirm_order_payment_stub(order)
        order.refresh_from_db()
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message') or '',
            'order': self.get_serializer(order).data,
        }, status=200 if result.get('ok') else 400)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        order = self.get_object()
        business = get_user_tenant_business(request.user)
        if order.client_business_id != getattr(business, 'id', None):
            return Response({'error': 'Permission refusee.'}, status=403)
        if order.status != 'DRAFT':
            return Response({'error': 'Seuls les brouillons peuvent etre envoyes.'}, status=400)
        if not order.items.exists():
            return Response({'error': 'Commande vide.'}, status=400)
        order.reference = generate_order_reference(order.wholesale_business)
        order.status = 'SUBMITTED'
        order.submitted_at = timezone.now()
        if request.data.get('notification_email'):
            order.notification_email = request.data['notification_email']
        order.save()
        recalculate_order_total(order)
        log_order_event(order, 'SUBMITTED', 'Commande envoyee par le client.', request.user)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        order = self.get_object()
        business = get_user_tenant_business(request.user)
        if order.wholesale_business_id != getattr(business, 'id', None):
            return Response({'error': 'Permission refusee.'}, status=403)
        try:
            order, email_result = accept_order(order, request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        data = self.get_serializer(order).data
        data['email_notification'] = email_result
        return Response(data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        order = self.get_object()
        business = get_user_tenant_business(request.user)
        if order.wholesale_business_id != getattr(business, 'id', None):
            return Response({'error': 'Permission refusee.'}, status=403)
        reason = request.data.get('reason', '').strip()
        comment = request.data.get('comment', '').strip()
        try:
            order, email_result = reject_order(order, request.user, reason, comment)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        data = self.get_serializer(order).data
        data['email_notification'] = email_result
        return Response(data)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        """Vendeur confirme paiement privé reçu (hors Isoko Hub)."""
        order = self.get_object()
        business = get_user_tenant_business(request.user)
        if order.wholesale_business_id != getattr(business, 'id', None):
            return Response({'error': 'Permission refusee.'}, status=403)
        try:
            order = mark_order_paid(
                order,
                request.user,
                payment_method=request.data.get('payment_method', ''),
                payment_note=request.data.get('payment_note', ''),
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], url_path='mark-unpaid')
    def mark_unpaid(self, request, pk=None):
        order = self.get_object()
        business = get_user_tenant_business(request.user)
        if order.wholesale_business_id != getattr(business, 'id', None):
            return Response({'error': 'Permission refusee.'}, status=403)
        try:
            order = mark_order_unpaid(order, request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(self.get_serializer(order).data)


class WholesaleCartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _get_client_business(self, request):
        business = get_user_tenant_business(request.user)
        if not business or not is_retail_pharmacy(business):
            return None
        return business

    def list(self, request):
        client = self._get_client_business(request)
        if not client:
            return Response({'error': 'Pharmacie de detail requise.'}, status=403)
        wholesale_id = request.query_params.get('wholesale')
        if not wholesale_id:
            carts = WholesaleCart.objects.filter(client_business=client).prefetch_related('items__product')
            return Response(WholesaleCartSerializer(carts, many=True).data)
        cart, _ = WholesaleCart.objects.get_or_create(
            client_business=client, wholesale_business_id=wholesale_id
        )
        return Response(WholesaleCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def add_item(self, request):
        client = self._get_client_business(request)
        if not client:
            return Response({'error': 'Pharmacie de detail requise.'}, status=403)
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity') or 1)
        try:
            product = WholesaleProduct.objects.get(id=product_id, status='ACTIVE')
        except WholesaleProduct.DoesNotExist:
            return Response({'error': 'Produit introuvable.'}, status=404)
        if quantity < 1:
            return Response({'error': 'Quantite minimale: 1'}, status=400)
        if quantity < product.min_order_quantity:
            return Response({'error': f'Quantite minimale: {product.min_order_quantity}'}, status=400)
        if quantity > product.quantity_available:
            return Response({'error': f'Stock disponible: {product.quantity_available}'}, status=400)
        cart, _ = WholesaleCart.objects.get_or_create(
            client_business=client, wholesale_business=product.wholesale_business
        )
        item, created = WholesaleCartItem.objects.get_or_create(cart=cart, product=product)
        if created:
            snapshot_cart_item(item, product)
            item.quantity = quantity
        else:
            item.quantity = item.quantity + quantity
            if not item.unit_price_snapshot:
                snapshot_cart_item(item, product)
        if item.quantity > product.quantity_available:
            item.quantity = product.quantity_available
        item.save()
        sync_draft_proforma(cart)
        return Response(WholesaleCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def update_item(self, request):
        client = self._get_client_business(request)
        item_id = request.data.get('item_id')
        quantity = int(request.data.get('quantity') or 0)
        try:
            item = WholesaleCartItem.objects.select_related('cart', 'product').get(
                id=item_id, cart__client_business=client
            )
        except WholesaleCartItem.DoesNotExist:
            return Response({'error': 'Ligne introuvable.'}, status=404)
        cart = item.cart
        if quantity <= 0:
            item.delete()
            sync_draft_proforma(cart)
            return Response(WholesaleCartSerializer(cart).data)
        if quantity < item.product.min_order_quantity:
            return Response({'error': f'Quantite minimale: {item.product.min_order_quantity}'}, status=400)
        if quantity > item.product.quantity_available:
            return Response({'error': 'Stock insuffisant.'}, status=400)
        item.quantity = quantity
        item.save()
        sync_draft_proforma(cart)
        return Response(WholesaleCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def remove_item(self, request):
        client = self._get_client_business(request)
        item_id = request.data.get('item_id')
        try:
            item = WholesaleCartItem.objects.select_related('cart').get(
                id=item_id, cart__client_business=client
            )
        except WholesaleCartItem.DoesNotExist:
            return Response({'error': 'Ligne introuvable.'}, status=404)
        cart = item.cart
        item.delete()
        sync_draft_proforma(cart)
        return Response(WholesaleCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def clear(self, request):
        client = self._get_client_business(request)
        if not client:
            return Response({'error': 'Pharmacie de detail requise.'}, status=403)
        wholesale_id = request.data.get('wholesale_id')
        if not wholesale_id:
            return Response({'error': 'wholesale_id requis.'}, status=400)
        try:
            cart = WholesaleCart.objects.get(
                client_business=client, wholesale_business_id=wholesale_id
            )
        except WholesaleCart.DoesNotExist:
            return Response({'error': 'Panier introuvable.'}, status=404)
        cart.items.all().delete()
        ProformaInvoice.objects.filter(cart=cart, status='DRAFT').update(status='CANCELLED')
        sync_draft_proforma(cart)
        return Response(WholesaleCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def checkout(self, request):
        client = self._get_client_business(request)
        if not client:
            return Response({'error': 'Pharmacie de detail requise.'}, status=403)
        wholesale_id = request.data.get('wholesale_id')
        confirmed = request.data.get('confirmed', False)
        if not confirmed:
            return Response({
                'error': 'Confirmation requise: cochez la verification des produits, quantites et montant.'
            }, status=400)
        payment_method, payer_phone, pay_err = _lumicash_payment_from_request(request.data)
        if pay_err:
            return Response({'error': pay_err}, status=400)
        try:
            cart = WholesaleCart.objects.prefetch_related('items__product').get(
                client_business=client, wholesale_business_id=wholesale_id
            )
        except WholesaleCart.DoesNotExist:
            return Response({'error': 'Panier introuvable.'}, status=404)
        if not cart.items.exists():
            return Response({'error': 'Panier vide.'}, status=400)

        # Validation finale disponibilité
        for item in cart.items.select_related('product'):
            p = item.product
            if p.status != 'ACTIVE':
                return Response({'error': f'Produit inactif: {p.name}'}, status=400)
            if item.quantity < p.min_order_quantity:
                return Response({'error': f'Quantite minimale pour {p.name}: {p.min_order_quantity}'}, status=400)
            if item.quantity > p.quantity_available:
                return Response({
                    'error': f'Stock insuffisant pour {p.name} (dispo: {p.quantity_available})'
                }, status=400)

        notification_email = (
            request.data.get('notification_email')
            or client.email
            or request.user.email
        )

        order = WholesaleOrder.objects.create(
            wholesale_business=cart.wholesale_business,
            client_business=client,
            created_by=request.user,
            status='DRAFT',
            currency='BIF',
            buyer_type='RETAIL_PHARMACY',
            buyer_name=client.name,
            buyer_email=notification_email,
            buyer_phone=client.phone or '',
            notification_email=notification_email,
            payment_method=payment_method or 'LUMICASH',
            payer_phone=payer_phone or '',
        )
        for item in cart.items.select_related('product'):
            p = item.product
            unit = item.unit_price_snapshot or p.wholesale_price
            WholesaleOrderItem.objects.create(
                order=order,
                product=p,
                product_name_snapshot=item.product_name_snapshot or p.name,
                packaging_snapshot=item.packaging_snapshot or p.packaging,
                wholesale_unit_snapshot=item.wholesale_unit_snapshot or p.wholesale_unit,
                unit_price_snapshot=unit,
                quantity=item.quantity,
                line_total=unit * item.quantity,
            )
        recalculate_order_total(order)
        log_order_event(order, 'CREATED', 'Commande creee depuis le panier.', request.user)

        proforma = sync_draft_proforma(cart)
        if not proforma:
            proforma = ProformaInvoice.objects.create(
                cart=None,
                client_business=client,
                wholesale_business=cart.wholesale_business,
                status='PENDING_VALIDATION',
                reference=generate_proforma_reference(cart.wholesale_business),
                subtotal=order.total_amount,
                total=order.total_amount,
                currency=order.currency,
                lines_snapshot=[
                    {
                        'product_name': i.product_name_snapshot,
                        'packaging': i.packaging_snapshot,
                        'unit_price': str(i.unit_price_snapshot),
                        'quantity': i.quantity,
                        'line_total': str(i.line_total),
                    }
                    for i in order.items.all()
                ],
            )
        else:
            proforma.status = 'PENDING_VALIDATION'
            proforma.subtotal = order.total_amount
            proforma.total = order.total_amount
            proforma.cart = None
            proforma.save(update_fields=['status', 'subtotal', 'total', 'cart', 'updated_at'])

        order.reference = generate_order_reference(order.wholesale_business)
        order.status = 'SUBMITTED'
        order.submitted_at = timezone.now()
        order.save()
        proforma.order = order
        proforma.save(update_fields=['order', 'updated_at'])
        log_order_event(order, 'SUBMITTED', 'Commande envoyee.', request.user)

        cart.items.all().delete()
        from .order_payment import initiate_order_payment
        from businesses import lumicash as lumicash_client
        pay_result = initiate_order_payment(order, payer_phone)
        order.refresh_from_db()
        data = WholesaleOrderSerializer(order).data
        data['payment_initiation'] = {
            'ok': pay_result.get('ok'),
            'already_paid': pay_result.get('already_paid', False),
            'message': pay_result.get('message') or '',
            'stub_mode': pay_result.get('stub_mode', lumicash_client.is_stub_mode()),
            'amount_bif': pay_result.get('amount_bif'),
            'merchant_account': pay_result.get('merchant_account'),
            'provider_reference': pay_result.get('provider_reference'),
        }
        return Response(data, status=201)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_proformas(request):
    business = get_user_tenant_business(request.user)
    if not business:
        return Response({'error': 'Aucune entreprise.'}, status=400)
    if is_retail_pharmacy(business):
        qs = ProformaInvoice.objects.filter(client_business=business).exclude(status='CANCELLED')
    elif is_wholesale_business(business):
        qs = ProformaInvoice.objects.filter(wholesale_business=business).exclude(status='CANCELLED')
    else:
        return Response({'error': 'Non eligible.'}, status=403)
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(ProformaInvoiceSerializer(qs.select_related(
        'client_business', 'wholesale_business', 'order'
    )[:100], many=True).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def wholesale_dashboard(request):
    business = get_user_tenant_business(request.user)
    if not business:
        return Response({'error': 'Aucune entreprise.'}, status=400)

    if is_wholesale_business(business):
        products = WholesaleProduct.objects.filter(wholesale_business=business)
        orders = WholesaleOrder.objects.filter(wholesale_business=business)
        active = products.filter(status='ACTIVE')
        stock_value = sum((p.quantity_real * p.wholesale_price for p in active), Decimal('0'))
        low = [p for p in active if p.stock_status == 'LOW_STOCK']
        out = [p for p in active if p.stock_status == 'OUT_OF_STOCK']
        return Response({
            'role': 'ADMIN',
            'business_id': str(business.id),
            'business_name': business.name,
            'products_active': active.count(),
            'stock_value': stock_value,
            'low_stock_count': len(low),
            'out_of_stock_count': len(out),
            'orders_total': orders.exclude(status='DRAFT').count(),
            'orders_pending': orders.filter(status__in=['SUBMITTED', 'PROCESSING']).count(),
            'orders_accepted': orders.filter(status='ACCEPTED').count(),
            'orders_rejected': orders.filter(status='REJECTED').count(),
            'revenue_accepted': orders.filter(status='ACCEPTED').aggregate(s=Sum('total_amount'))['s'] or 0,
            'recent_orders': WholesaleOrderSerializer(orders.exclude(status='DRAFT')[:8], many=True).data,
            'top_products': list(
                WholesaleOrderItem.objects.filter(
                    order__wholesale_business=business, order__status='ACCEPTED'
                ).values('product_name_snapshot').annotate(qty=Sum('quantity')).order_by('-qty')[:5]
            ),
        })

    if is_retail_pharmacy(business):
        orders = WholesaleOrder.objects.filter(client_business=business)
        return Response({
            'role': 'CLIENT',
            'business_id': str(business.id),
            'business_name': business.name,
            'orders_pending': orders.filter(status__in=['SUBMITTED', 'PROCESSING', 'DRAFT']).count(),
            'orders_accepted': orders.filter(status='ACCEPTED').count(),
            'orders_rejected': orders.filter(status='REJECTED').count(),
            'orders_total_amount': orders.exclude(status='DRAFT').aggregate(s=Sum('total_amount'))['s'] or 0,
            'recent_orders': WholesaleOrderSerializer(orders[:8], many=True).data,
        })

    return Response({'error': 'Entreprise non eligible au module wholesale.'}, status=400)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def wholesale_clients(request):
    """Liste des pharmacies clientes (comptes Business + commandes guest agrégées)."""
    business = get_user_tenant_business(request.user)
    if not business or not is_wholesale_business(business):
        return Response({'error': 'Permission refusee.'}, status=403)

    orders = WholesaleOrder.objects.filter(
        wholesale_business=business
    ).exclude(status='DRAFT').select_related('client_business')

    # Agrégation par clé: business:{uuid} ou email:{email_normalisé}
    buckets = {}

    def _bucket_key(order):
        if order.client_business_id:
            return f'business:{order.client_business_id}'
        email = (order.buyer_email or order.notification_email or '').strip().lower()
        if email:
            return f'email:{email}'
        name = (order.buyer_name or 'Client').strip().lower()
        return f'name:{name}'

    for order in orders:
        key = _bucket_key(order)
        b = buckets.get(key)
        if not b:
            b = {
                'id': key,
                'name': '',
                'email': '',
                'phone': '',
                'commune': '',
                'has_account': False,
                'client_business_id': None,
                'orders_count': 0,
                'orders_submitted': 0,
                'orders_accepted': 0,
                'orders_rejected': 0,
                'amount_accepted': Decimal('0'),
                'amount_total': Decimal('0'),
                'last_order_at': None,
                'first_order_at': None,
            }
            buckets[key] = b

        b['orders_count'] += 1
        b['amount_total'] += order.total_amount or Decimal('0')
        if order.status in ('SUBMITTED', 'PROCESSING'):
            b['orders_submitted'] += 1
        elif order.status == 'ACCEPTED':
            b['orders_accepted'] += 1
            b['amount_accepted'] += order.total_amount or Decimal('0')
        elif order.status == 'REJECTED':
            b['orders_rejected'] += 1

        ts = order.submitted_at or order.created_at
        if not b['last_order_at'] or (ts and ts > b['last_order_at']):
            b['last_order_at'] = ts
        if not b['first_order_at'] or (ts and ts < b['first_order_at']):
            b['first_order_at'] = ts

        if order.client_business_id and order.client_business:
            c = order.client_business
            b['has_account'] = True
            b['client_business_id'] = str(c.id)
            b['name'] = c.name
            b['email'] = c.email or order.buyer_email or order.notification_email or ''
            b['phone'] = c.phone or order.buyer_phone or ''
            b['commune'] = c.commune or ''
        else:
            if not b['name']:
                b['name'] = order.buyer_name or order.notification_email or 'Pharmacie cliente'
            if not b['email']:
                b['email'] = order.buyer_email or order.notification_email or ''
            if not b['phone']:
                b['phone'] = order.buyer_phone or ''

    # Statut dérivé
    data = []
    q = (request.query_params.get('q') or '').strip().lower()
    status_filter = (request.query_params.get('status') or '').strip().upper()
    account_filter = (request.query_params.get('account') or '').strip().lower()  # with|without|''

    for b in buckets.values():
        if b['orders_accepted'] > 0:
            b['status'] = 'ACTIVE'
            b['status_label'] = 'Active'
        elif b['orders_submitted'] > 0:
            b['status'] = 'PENDING'
            b['status_label'] = 'En commande'
        else:
            b['status'] = 'ACTIVE'
            b['status_label'] = 'Active'

        if q:
            hay = f"{b['name']} {b['email']} {b['phone']} {b['commune']}".lower()
            if q not in hay:
                continue
        if status_filter and b['status'] != status_filter:
            continue
        if account_filter == 'with' and not b['has_account']:
            continue
        if account_filter == 'without' and b['has_account']:
            continue

        b['amount_accepted'] = b['amount_accepted']
        b['amount_total'] = b['amount_total']
        data.append(b)

    data.sort(key=lambda x: x['last_order_at'] or timezone.now(), reverse=True)
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def wholesale_client_detail(request, client_key):
    """Fiche d'une pharmacie cliente + dernières commandes."""
    business = get_user_tenant_business(request.user)
    if not business or not is_wholesale_business(business):
        return Response({'error': 'Permission refusee.'}, status=403)

    qs = WholesaleOrder.objects.filter(
        wholesale_business=business
    ).exclude(status='DRAFT').select_related('client_business').prefetch_related('items')

    if client_key.startswith('business:'):
        biz_id = client_key.split(':', 1)[1]
        qs = qs.filter(client_business_id=biz_id)
    elif client_key.startswith('email:'):
        email = client_key.split(':', 1)[1].strip().lower()
        from django.db.models import Q
        qs = qs.filter(
            Q(buyer_email__iexact=email) | Q(notification_email__iexact=email),
            client_business__isnull=True,
        )
    elif client_key.startswith('name:'):
        name = client_key.split(':', 1)[1].strip()
        qs = qs.filter(buyer_name__iexact=name, client_business__isnull=True)
    else:
        return Response({'error': 'Client introuvable.'}, status=404)

    orders = list(qs.order_by('-created_at'))
    if not orders:
        return Response({'error': 'Client introuvable.'}, status=404)

    # Réutiliser l'agrégation liste pour la fiche
    first = orders[0]
    if first.client_business_id and first.client_business:
        c = first.client_business
        profile = {
            'id': client_key,
            'name': c.name,
            'email': c.email or first.buyer_email or first.notification_email or '',
            'phone': c.phone or first.buyer_phone or '',
            'commune': c.commune or '',
            'address': getattr(c, 'address', '') or '',
            'has_account': True,
            'client_business_id': str(c.id),
        }
    else:
        profile = {
            'id': client_key,
            'name': first.buyer_name or 'Pharmacie cliente',
            'email': first.buyer_email or first.notification_email or '',
            'phone': first.buyer_phone or '',
            'commune': '',
            'address': '',
            'has_account': False,
            'client_business_id': None,
        }

    accepted = [o for o in orders if o.status == 'ACCEPTED']
    rejected = [o for o in orders if o.status == 'REJECTED']
    submitted = [o for o in orders if o.status in ('SUBMITTED', 'PROCESSING')]

    profile.update({
        'orders_count': len(orders),
        'orders_submitted': len(submitted),
        'orders_accepted': len(accepted),
        'orders_rejected': len(rejected),
        'amount_accepted': sum((o.total_amount for o in accepted), Decimal('0')),
        'amount_total': sum((o.total_amount for o in orders), Decimal('0')),
        'last_order_at': (orders[0].submitted_at or orders[0].created_at) if orders else None,
        'first_order_at': (orders[-1].submitted_at or orders[-1].created_at) if orders else None,
        'status': 'ACTIVE' if accepted else ('PENDING' if submitted else 'ACTIVE'),
        'status_label': 'Active' if accepted else ('En commande' if submitted else 'Active'),
        'recent_orders': WholesaleOrderSerializer(orders[:20], many=True).data,
    })
    return Response(profile)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_wholesale_pharmacies(request):
    businesses = Business.objects.filter(
        is_active=True, is_verified=True, verification_status='APPROVED',
    ).select_related('primary_category')
    result = []
    for b in businesses:
        if is_wholesale_business(b):
            profile = ensure_wholesale_profile(b)
            if profile.status in ('ACTIVE', 'DRAFT'):
                result.append({
                    'id': str(b.id),
                    'name': b.name,
                    'commercial_name': profile.commercial_name or b.name,
                    'logo': b.logo,
                    'commune': b.commune,
                    'phone': b.phone,
                    'email': b.email,
                    'description': b.description,
                })
    return Response(result)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def guest_checkout(request):
    """Commande depuis le catalogue public (pharmacie de detail, sans compte requis)."""
    wholesale_id = request.data.get('wholesale_id')
    items = request.data.get('items') or []
    buyer_type = 'RETAIL_PHARMACY'
    buyer_name = (request.data.get('buyer_name') or '').strip()
    buyer_email = (request.data.get('buyer_email') or '').strip()
    buyer_phone = (request.data.get('buyer_phone') or '').strip()

    if not wholesale_id or not items:
        return Response({'error': 'Catalogue et articles requis.'}, status=400)
    if not buyer_name or not buyer_email:
        return Response({'error': 'Nom de la pharmacie et email requis.'}, status=400)

    payment_method, payer_phone, pay_err = _lumicash_payment_from_request(request.data)
    if pay_err:
        return Response({'error': pay_err}, status=400)

    try:
        wholesale = Business.objects.get(id=wholesale_id, is_active=True)
    except Business.DoesNotExist:
        return Response({'error': 'Pharmacie introuvable.'}, status=404)
    if not is_wholesale_business(wholesale):
        return Response({'error': 'Entreprise non eligible.'}, status=400)

    client_business = None
    user = request.user if request.user and request.user.is_authenticated else None
    if user:
        biz = get_user_tenant_business(user)
        if biz and is_retail_pharmacy(biz):
            client_business = biz
            buyer_name = buyer_name or biz.name
            buyer_email = buyer_email or biz.email or user.email

    order = WholesaleOrder.objects.create(
        wholesale_business=wholesale,
        client_business=client_business,
        created_by=user,
        status='DRAFT',
        currency='BIF',
        buyer_type=buyer_type,
        buyer_name=buyer_name,
        buyer_email=buyer_email,
        buyer_phone=buyer_phone,
        notification_email=buyer_email,
        payment_method=payment_method or 'LUMICASH',
        payer_phone=payer_phone or '',
    )

    for row in items:
        try:
            product = WholesaleProduct.objects.get(
                id=row.get('product_id'), wholesale_business=wholesale, status='ACTIVE'
            )
        except WholesaleProduct.DoesNotExist:
            order.delete()
            return Response({'error': f"Produit introuvable: {row.get('product_id')}"}, status=400)
        qty = int(row.get('quantity') or 1)
        if qty < product.min_order_quantity:
            order.delete()
            return Response({'error': f'Quantite minimale pour {product.name}: {product.min_order_quantity}'}, status=400)
        if qty > product.quantity_available:
            order.delete()
            return Response({'error': f'Stock insuffisant pour {product.name}'}, status=400)
        WholesaleOrderItem.objects.create(
            order=order,
            product=product,
            product_name_snapshot=product.name,
            packaging_snapshot=product.packaging,
            wholesale_unit_snapshot=product.wholesale_unit,
            unit_price_snapshot=product.wholesale_price,
            quantity=qty,
            line_total=product.wholesale_price * qty,
        )

    recalculate_order_total(order)
    order.reference = generate_order_reference(wholesale)
    order.status = 'SUBMITTED'
    order.submitted_at = timezone.now()
    order.save()
    log_order_event(
        order, 'SUBMITTED',
        f'Commande catalogue public: {buyer_name}',
        user,
    )
    from .order_payment import initiate_order_payment
    from businesses import lumicash as lumicash_client
    pay_result = initiate_order_payment(order, payer_phone)
    order.refresh_from_db()
    data = WholesaleOrderSerializer(order).data
    data['payment_initiation'] = {
        'ok': pay_result.get('ok'),
        'already_paid': pay_result.get('already_paid', False),
        'message': pay_result.get('message') or '',
        'stub_mode': pay_result.get('stub_mode', lumicash_client.is_stub_mode()),
        'amount_bif': pay_result.get('amount_bif'),
        'merchant_account': pay_result.get('merchant_account'),
        'provider_reference': pay_result.get('provider_reference'),
    }
    return Response(data, status=201)

