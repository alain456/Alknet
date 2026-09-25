from decimal import Decimal
import json

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Sum, When
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from businesses.models import Business
from businesses.tenant import get_user_tenant_business

from .models import (
    Prescription,
    ProformaInvoice,
    RetailCart,
    RetailCartItem,
    RetailOrder,
    RetailPharmacyProfile,
    RetailProduct,
    StockMovement,
)
from .order_workflow import (
    REJECTION_REASONS,
    accept_order,
    adjust_stock,
    create_order_from_items,
    create_order_proforma,
    ensure_retail_profile,
    mark_order_paid,
    mark_order_unpaid,
    reject_order,
    request_clarification,
    snapshot_cart_item,
    sync_draft_proforma,
)
from .permissions import IsRetailPharmacyAdmin, is_retail_pharmacy
from .prescription_files import (
    attach_prescription_file,
    extract_prescription_upload,
)
from .serializers import (
    PrescriptionSerializer,
    ProformaInvoiceSerializer,
    RetailCartSerializer,
    RetailOrderSerializer,
    RetailProductPublicSerializer,
    RetailProductSerializer,
    RetailProfileSerializer,
    StockMovementSerializer,
)


def _admin_business(user):
    business = get_user_tenant_business(user)
    if (
        business
        and business.owner_id == getattr(user, 'id', None)
        and is_retail_pharmacy(business)
    ):
        return business
    return None


def _patient_details(user, data):
    name = (data.get('patient_name') or '').strip()
    email = (data.get('patient_email') or '').strip()
    phone = (data.get('patient_phone') or '').strip()
    if user and user.is_authenticated:
        name = name or user.get_full_name()
        email = email or user.email
        phone = phone or getattr(user, 'phone_number', '') or ''
    return name, email, phone


def _burundipay_payment_from_request(data):
    """Extrait moyen de paiement + numéro BurundiPay (requis) pour une commande."""
    from businesses.burundipay import is_burundipay_method, normalize_phone

    method = (data.get('payment_method') or 'BURUNDIPAY').strip().upper() or 'BURUNDIPAY'
    if method == 'LUMICASH':
        method = 'BURUNDIPAY'
    raw_phone = (
        data.get('payer_phone')
        or data.get('burundipay_phone')
        or data.get('payer_burundipay')
        or data.get('lumicash_phone')
        or data.get('payer_lumicash')
        or ''
    ).strip()
    if not is_burundipay_method(method):
        return method, raw_phone[:40], None
    if not raw_phone:
        return None, None, 'Indiquez votre numéro BurundiPay (banque ou mobile money) pour le paiement.'
    phone = normalize_phone(raw_phone)
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) < 8:
        return None, None, 'Numéro BurundiPay invalide.'
    return 'BURUNDIPAY', phone[:40], None


def _parse_items_payload(raw):
    if raw is None or raw == '':
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return None
    if not isinstance(raw, list):
        return None
    return raw


def _create_order_prescription(*, business, order, patient, name, email, request):
    """Crée une Prescription depuis upload fichier (prioritaire) ou URL legacy."""
    uploaded = extract_prescription_upload(request.data)
    if uploaded is None and hasattr(request, 'FILES'):
        uploaded = extract_prescription_upload(request.FILES)
    legacy_url = (request.data.get('prescription_file_url') or request.data.get('file_url') or '').strip()
    if not uploaded and not legacy_url:
        return None
    prescription = Prescription(
        retail_business=business,
        order=order,
        patient=patient,
        patient_name=name,
        patient_email=email,
        file_url=legacy_url if not uploaded else '',
    )
    if uploaded:
        attach_prescription_file(prescription, uploaded)
    prescription.save()
    return prescription


def _prescription_required_error(needs_rx, request):
    if not needs_rx:
        return None
    uploaded = extract_prescription_upload(request.data)
    if uploaded is None and hasattr(request, 'FILES'):
        uploaded = extract_prescription_upload(request.FILES)
    legacy_url = (request.data.get('prescription_file_url') or request.data.get('file_url') or '').strip()
    if uploaded or legacy_url:
        return None
    return 'Ordonnance obligatoire : joignez un fichier (image ou PDF).'


class RetailProfileViewSet(viewsets.ModelViewSet):
    serializer_class = RetailProfileSerializer
    permission_classes = [IsRetailPharmacyAdmin]

    def get_queryset(self):
        business = _admin_business(self.request.user)
        if not business:
            return RetailPharmacyProfile.objects.none()
        return RetailPharmacyProfile.objects.filter(business=business)

    def list(self, request, *args, **kwargs):
        business = _admin_business(request.user)
        return Response(self.get_serializer(ensure_retail_profile(business)).data)

    def _update_profile(self, request):
        business = _admin_business(request.user)
        profile = ensure_retail_profile(business)
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        fields = {
            key: request.data[key]
            for key in ('phone', 'email', 'address', 'description', 'website')
            if key in request.data
        }
        if fields:
            for key, value in fields.items():
                setattr(business, key, value)
            business.save(update_fields=[*fields.keys(), 'updated_at'])
        return Response(self.get_serializer(profile).data)

    def partial_update(self, request, *args, **kwargs):
        return self._update_profile(request)

    @action(detail=False, methods=['patch', 'put'])
    def me(self, request):
        return self._update_profile(request)


class RetailProductViewSet(viewsets.ModelViewSet):
    def get_authenticators(self):
        public = self.request.GET.get('public', '').lower() in ('1', 'true')
        if public and self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return []
        return super().get_authenticators()

    def get_permissions(self):
        public = self.request.query_params.get('public', '').lower() in ('1', 'true')
        if self.action in ('list', 'retrieve') and public:
            return [permissions.AllowAny()]
        # Lecture authentifiée (admin détail, patient, etc.)
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        # Écriture : uniquement admin pharmacie de détail
        return [IsRetailPharmacyAdmin()]

    def create(self, request, *args, **kwargs):
        if not _admin_business(request.user):
            return Response(
                {
                    'detail': (
                        "Accès réservé à l'administrateur d'une pharmacie de détail. "
                        "Reconnectez-vous avec le compte de votre officine "
                        "(ex. admin.pdetail@isoko.com)."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not _admin_business(request.user):
            return Response(
                {
                    'detail': (
                        "Accès réservé à l'administrateur d'une pharmacie de détail."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    def get_serializer_class(self):
        return (
            RetailProductSerializer
            if _admin_business(self.request.user)
            else RetailProductPublicSerializer
        )

    def get_queryset(self):
        qs = RetailProduct.objects.select_related('retail_business')
        public = self.request.query_params.get('public', '').lower() in ('1', 'true')
        retail_id = self.request.query_params.get('retail') or self.request.query_params.get('pharmacy')
        if public:
            qs = qs.filter(
                status='ACTIVE',
                retail_business__is_active=True,
                retail_business__is_verified=True,
                retail_business__verification_status='APPROVED',
            )
            return qs.filter(retail_business_id=retail_id) if retail_id else qs
        business = _admin_business(self.request.user)
        if business:
            return qs.filter(retail_business=business)
        if getattr(self.request.user, 'is_authenticated', False):
            qs = qs.filter(status='ACTIVE')
            return qs.filter(retail_business_id=retail_id) if retail_id else qs
        return qs.none()

    def perform_create(self, serializer):
        business = _admin_business(self.request.user)
        serializer.save(retail_business=business)
        ensure_retail_profile(business)

    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        quantity = request.data.get('quantity_real')
        if quantity is None:
            return Response({'error': 'quantity_real requis.'}, status=400)
        try:
            adjust_stock(
                product, int(quantity), request.data.get('reason') or 'Ajustement manuel',
                request.user,
            )
        except (TypeError, ValueError):
            return Response({'error': 'Quantite invalide.'}, status=400)
        return Response(RetailProductSerializer(product).data)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        products = [
            product for product in self.get_queryset()
            if product.stock_status in ('LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED')
        ]
        return Response(RetailProductSerializer(products, many=True).data)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsRetailPharmacyAdmin]

    def get_queryset(self):
        business = _admin_business(self.request.user)
        return StockMovement.objects.filter(
            product__retail_business=business
        ).select_related('product', 'user', 'order')


class RetailOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RetailOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if getattr(self, 'action', None) in ('pay', 'confirm_payment'):
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if getattr(self, 'action', None) in ('pay', 'confirm_payment'):
            return RetailOrder.objects.select_related(
                'retail_business', 'patient', 'created_by', 'proforma'
            ).prefetch_related('items')

        business = _admin_business(user)
        qs = RetailOrder.objects.select_related(
            'retail_business', 'patient', 'created_by', 'proforma'
        ).prefetch_related(
            'items', 'events', 'prescriptions', 'notification_logs'
        )

        params = self.request.query_params
        pharmacy_id = (
            params.get('pharmacy')
            or params.get('retail_business')
            or params.get('business')
        )

        # Historique client pour une pharmacie précise (ex. JoyPharma) :
        # commandes du compte OU passées en invité avec le même email.
        # Prioritaire même si l'utilisateur est aussi admin ailleurs / SUPER_ADMIN.
        if pharmacy_id and user.is_authenticated:
            email = (getattr(user, 'email', None) or '').strip()
            own = Q(patient=user) | Q(created_by=user)
            if email:
                own |= Q(patient_email__iexact=email) | Q(notification_email__iexact=email)
            qs = qs.filter(retail_business_id=pharmacy_id).filter(own)
        elif business:
            qs = qs.filter(retail_business=business)
        elif user.is_authenticated:
            email = (getattr(user, 'email', None) or '').strip()
            own = Q(patient=user) | Q(created_by=user)
            if email:
                own |= Q(patient_email__iexact=email) | Q(notification_email__iexact=email)
            qs = qs.filter(own)
        else:
            return qs.none()

        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('patient_email'):
            qs = qs.filter(patient_email__iexact=params['patient_email'].strip())
        if params.get('q'):
            term = params['q'].strip()
            qs = qs.filter(
                Q(reference__icontains=term)
                | Q(patient_name__icontains=term)
                | Q(patient_email__icontains=term)
            )
        return qs.annotate(
            _priority=Case(
                When(status='SUBMITTED', then=0),
                When(status='PROCESSING', then=1),
                When(status='CLARIFICATION_REQUESTED', then=2),
                default=3,
                output_field=IntegerField(),
            )
        ).order_by('_priority', '-created_at')

    def _require_admin_order(self, request, order):
        business = _admin_business(request.user)
        return bool(business and order.retail_business_id == business.id)

    @action(detail=False, methods=['get'])
    def rejection_reasons(self, request):
        return Response(REJECTION_REASONS)

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        """Client : paie la commande via BurundiPay → marchand pharmacie."""
        from businesses import burundipay as burundipay_client
        from .order_payment import initiate_order_payment

        order = self.get_object()
        payer_phone = (
            request.data.get('payer_phone')
            or request.data.get('phone')
            or order.payer_phone
            or ''
        ).strip()
        if not payer_phone:
            return Response({'error': 'payer_phone (BurundiPay) requis.'}, status=400)
        result = initiate_order_payment(order, payer_phone)
        order.refresh_from_db()
        data = self.get_serializer(order).data
        return Response({
            'ok': result.get('ok'),
            'already_paid': result.get('already_paid', False),
            'message': result.get('message') or '',
            'stub_mode': result.get('stub_mode', burundipay_client.is_stub_mode()),
            'amount_bif': result.get('amount_bif'),
            'currency': result.get('currency'),
            'merchant_account': result.get('merchant_account'),
            'provider_reference': result.get('provider_reference'),
            'order': data,
        }, status=200 if result.get('ok') else 400)

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        """Simulation : confirme le PIN BurundiPay pour une commande."""
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
    def accept(self, request, pk=None):
        order = self.get_object()
        if not self._require_admin_order(request, order):
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
        if not self._require_admin_order(request, order):
            return Response({'error': 'Permission refusee.'}, status=403)
        try:
            order, email_result = reject_order(
                order, request.user,
                (request.data.get('reason') or '').strip(),
                (request.data.get('comment') or '').strip(),
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        data = self.get_serializer(order).data
        data['email_notification'] = email_result
        return Response(data)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        """Pharmacie confirme paiement privé reçu (hors Isoko Hub)."""
        order = self.get_object()
        if not self._require_admin_order(request, order):
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
        if not self._require_admin_order(request, order):
            return Response({'error': 'Permission refusee.'}, status=403)
        try:
            order = mark_order_unpaid(order, request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], url_path='request-clarification')
    def request_clarification_action(self, request, pk=None):
        order = self.get_object()
        if not self._require_admin_order(request, order):
            return Response({'error': 'Permission refusee.'}, status=403)
        try:
            order, email_result = request_clarification(
                order, request.user, (request.data.get('comment') or '').strip()
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        data = self.get_serializer(order).data
        data['email_notification'] = email_result
        return Response(data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.patient_id != request.user.id or order.status not in (
            'DRAFT', 'SUBMITTED', 'CLARIFICATION_REQUESTED'
        ):
            return Response({'error': 'Commande non annulable.'}, status=400)
        order.status = 'CANCELLED'
        order.save(update_fields=['status', 'updated_at'])
        ProformaInvoice.objects.filter(order=order).update(status='CANCELLED')
        return Response(self.get_serializer(order).data)


class RetailCartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _is_patient(self, request):
        return request.user.role == 'CUSTOMER'

    def list(self, request):
        if not self._is_patient(request):
            return Response({'error': 'Compte patient requis.'}, status=403)
        pharmacy_id = request.query_params.get('retail') or request.query_params.get('pharmacy')
        if pharmacy_id:
            cart, _ = RetailCart.objects.get_or_create(
                patient=request.user, retail_business_id=pharmacy_id
            )
            return Response(RetailCartSerializer(cart).data)
        carts = RetailCart.objects.filter(patient=request.user).prefetch_related('items__product')
        return Response(RetailCartSerializer(carts, many=True).data)

    @action(detail=False, methods=['post'])
    def add_item(self, request):
        if not self._is_patient(request):
            return Response({'error': 'Compte patient requis.'}, status=403)
        try:
            product = RetailProduct.objects.get(
                id=request.data.get('product_id'), status='ACTIVE'
            )
            quantity = int(request.data.get('quantity') or 1)
        except (RetailProduct.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Produit ou quantite invalide.'}, status=400)
        if quantity < 1 or quantity > product.quantity_available:
            return Response({'error': 'Stock insuffisant ou quantite invalide.'}, status=400)
        cart, _ = RetailCart.objects.get_or_create(
            patient=request.user, retail_business=product.retail_business
        )
        item, created = RetailCartItem.objects.get_or_create(cart=cart, product=product)
        item.quantity = quantity if created else item.quantity + quantity
        if item.quantity > product.quantity_available:
            return Response({'error': 'Stock insuffisant.'}, status=400)
        snapshot_cart_item(item, product)
        item.save()
        sync_draft_proforma(cart)
        return Response(RetailCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def update_item(self, request):
        try:
            item = RetailCartItem.objects.select_related('cart', 'product').get(
                id=request.data.get('item_id'), cart__patient=request.user
            )
            quantity = int(request.data.get('quantity') or 0)
        except (RetailCartItem.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Ligne ou quantite invalide.'}, status=400)
        cart = item.cart
        if quantity <= 0:
            item.delete()
        elif quantity > item.product.quantity_available:
            return Response({'error': 'Stock insuffisant.'}, status=400)
        else:
            item.quantity = quantity
            item.save(update_fields=['quantity', 'updated_at'])
        sync_draft_proforma(cart)
        return Response(RetailCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def remove_item(self, request):
        try:
            item = RetailCartItem.objects.select_related('cart').get(
                id=request.data.get('item_id'), cart__patient=request.user
            )
        except RetailCartItem.DoesNotExist:
            return Response({'error': 'Ligne introuvable.'}, status=404)
        cart = item.cart
        item.delete()
        sync_draft_proforma(cart)
        return Response(RetailCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    def clear(self, request):
        pharmacy_id = request.data.get('retail_id') or request.data.get('pharmacy_id')
        try:
            cart = RetailCart.objects.get(
                patient=request.user, retail_business_id=pharmacy_id
            )
        except RetailCart.DoesNotExist:
            return Response({'error': 'Panier introuvable.'}, status=404)
        cart.items.all().delete()
        sync_draft_proforma(cart)
        return Response(RetailCartSerializer(cart).data)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def checkout(self, request):
        if not self._is_patient(request):
            return Response({'error': 'Compte patient requis.'}, status=403)
        pharmacy_id = request.data.get('retail_id') or request.data.get('pharmacy_id')
        try:
            cart = RetailCart.objects.prefetch_related('items__product').get(
                patient=request.user, retail_business_id=pharmacy_id
            )
        except RetailCart.DoesNotExist:
            return Response({'error': 'Panier introuvable.'}, status=404)
        if not cart.items.exists():
            return Response({'error': 'Panier vide.'}, status=400)
        profile = ensure_retail_profile(cart.retail_business)
        if not profile.is_open_for_orders:
            return Response(
                {'error': 'Cette pharmacie a temporairement bloqué les nouvelles commandes.'},
                status=400,
            )
        name, email, phone = _patient_details(request.user, request.data)
        payment_method, payer_phone, pay_err = _burundipay_payment_from_request(request.data)
        if pay_err:
            return Response({'error': pay_err}, status=400)
        file_url = (request.data.get('prescription_file_url') or '').strip()
        needs_rx = any(
            item.product and item.product.prescription_required
            for item in cart.items.all()
        )
        rx_err = _prescription_required_error(needs_rx, request)
        if rx_err:
            return Response({'error': rx_err}, status=400)
        try:
            order = create_order_from_items(
                cart.retail_business,
                [
                    {'product_id': str(item.product_id), 'quantity': item.quantity}
                    for item in cart.items.all()
                ],
                name, email, phone, patient=request.user, user=request.user,
                payer_phone=payer_phone, payment_method=payment_method,
            )
            proforma = create_order_proforma(order)
            try:
                _create_order_prescription(
                    business=cart.retail_business,
                    order=order,
                    patient=request.user,
                    name=name,
                    email=email,
                    request=request,
                )
            except DjangoValidationError as exc:
                raise ValueError(exc.messages[0] if getattr(exc, 'messages', None) else str(exc))
            proforma.cart = None
            proforma.save(update_fields=['cart', 'updated_at'])
            cart.items.all().delete()
        except (RetailProduct.DoesNotExist, ValueError) as exc:
            return Response({'error': str(exc)}, status=400)
        from .order_payment import initiate_order_payment
        from businesses import burundipay as burundipay_client
        pay_result = initiate_order_payment(order, payer_phone)
        order.refresh_from_db()
        data = RetailOrderSerializer(order).data
        data['payment_initiation'] = {
            'ok': pay_result.get('ok'),
            'already_paid': pay_result.get('already_paid', False),
            'message': pay_result.get('message') or '',
            'stub_mode': pay_result.get('stub_mode', burundipay_client.is_stub_mode()),
            'amount_bif': pay_result.get('amount_bif'),
            'merchant_account': pay_result.get('merchant_account'),
            'provider_reference': pay_result.get('provider_reference'),
        }
        return Response(data, status=201)


class PrescriptionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.CreateModelMixin, viewsets.GenericViewSet,
):
    serializer_class = PrescriptionSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        business = _admin_business(self.request.user)
        if business:
            return Prescription.objects.filter(retail_business=business).select_related(
                'order', 'patient', 'reviewed_by'
            )
        if self.request.user.role == 'CUSTOMER':
            return Prescription.objects.filter(patient=self.request.user).select_related(
                'order', 'reviewed_by'
            )
        return Prescription.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user if request.user.is_authenticated else None
        order_id = request.data.get('order')
        try:
            order = RetailOrder.objects.get(id=order_id)
        except RetailOrder.DoesNotExist:
            return Response({'error': 'Commande introuvable.'}, status=404)
        supplied_email = (request.data.get('patient_email') or '').strip().lower()
        owns_order = bool(user and order.patient_id == user.id)
        if not owns_order and supplied_email != order.patient_email.lower():
            return Response({'error': 'Informations patient invalides.'}, status=403)
        uploaded = extract_prescription_upload(request.data)
        if uploaded is None and hasattr(request, 'FILES'):
            uploaded = extract_prescription_upload(request.FILES)
        legacy_url = (request.data.get('file_url') or request.data.get('prescription_file_url') or '').strip()
        if not uploaded and not legacy_url:
            return Response({'error': 'Joignez un fichier ordonnance (image ou PDF).'}, status=400)
        prescription = Prescription(
            retail_business=order.retail_business,
            order=order,
            patient=order.patient,
            patient_name=order.patient_name,
            patient_email=order.patient_email,
            file_url=legacy_url if not uploaded else '',
        )
        try:
            if uploaded:
                attach_prescription_file(prescription, uploaded)
            prescription.save()
        except DjangoValidationError as exc:
            return Response(
                {'error': (exc.messages[0] if getattr(exc, 'messages', None) else str(exc))},
                status=400,
            )
        return Response(self.get_serializer(prescription).data, status=201)

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        prescription = self.get_object()
        business = _admin_business(request.user)
        if not business or prescription.retail_business_id != business.id:
            return Response({'error': 'Permission refusee.'}, status=403)
        new_status = (request.data.get('status') or '').upper()
        if new_status not in ('REVIEWED', 'ACCEPTED', 'REJECTED'):
            return Response({'error': 'Statut de revue invalide.'}, status=400)
        prescription.status = new_status
        prescription.review_comment = (request.data.get('comment') or '').strip()
        prescription.reviewed_by = request.user
        prescription.reviewed_at = timezone.now()
        prescription.save(update_fields=[
            'status', 'review_comment', 'reviewed_by', 'reviewed_at', 'updated_at',
        ])
        data = self.get_serializer(prescription).data
        if new_status in ('ACCEPTED', 'REJECTED'):
            from .order_workflow import notify_prescription_reviewed
            data['email_notification'] = notify_prescription_reviewed(prescription)
        return Response(data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_retail_pharmacies(request):
    result = []
    for business in Business.objects.filter(
        is_active=True, is_verified=True, verification_status='APPROVED',
    ).select_related('primary_category'):
        if is_retail_pharmacy(business):
            profile = ensure_retail_profile(business)
            if profile.status in ('ACTIVE', 'DRAFT'):
                result.append({
                    'id': str(business.id),
                    'name': business.name,
                    'commercial_name': profile.commercial_name or business.name,
                    'logo': business.logo,
                    'commune': business.commune,
                    'phone': business.phone,
                    'email': business.email,
                    'description': business.description,
                    'is_open_for_orders': profile.is_open_for_orders,
                })
    return Response(result)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@transaction.atomic
def guest_checkout(request):
    pharmacy_id = request.data.get('retail_id') or request.data.get('pharmacy_id')
    rows = _parse_items_payload(request.data.get('items'))
    if rows is None:
        return Response({'error': 'Format items invalide.'}, status=400)
    name, email, phone = _patient_details(
        request.user if request.user.is_authenticated else None, request.data
    )
    if not pharmacy_id or not rows:
        return Response({'error': 'Pharmacie et articles requis.'}, status=400)
    if not name or not email:
        return Response({'error': 'Nom et email du patient requis.'}, status=400)
    payment_method, payer_phone, pay_err = _burundipay_payment_from_request(request.data)
    if pay_err:
        return Response({'error': pay_err}, status=400)
    try:
        business = Business.objects.select_related('primary_category').get(
            id=pharmacy_id, is_active=True
        )
    except Business.DoesNotExist:
        return Response({'error': 'Pharmacie introuvable.'}, status=404)
    if not is_retail_pharmacy(business):
        return Response({'error': 'Entreprise non eligible.'}, status=400)
    profile = ensure_retail_profile(business)
    if not profile.is_open_for_orders:
        return Response(
            {'error': 'Cette pharmacie a temporairement bloqué les nouvelles commandes.'},
            status=400,
        )
    # Client connecté → rattacher la commande à son compte (historique visible)
    user = request.user if request.user.is_authenticated else None
    if user and getattr(user, 'role', None) == 'SUPER_ADMIN':
        user = None
    product_ids = [row.get('product_id') for row in rows if row.get('product_id')]
    needs_rx = RetailProduct.objects.filter(
        id__in=product_ids, retail_business=business, prescription_required=True,
    ).exists()
    rx_err = _prescription_required_error(needs_rx, request)
    if rx_err:
        return Response({'error': rx_err}, status=400)
    try:
        order = create_order_from_items(
            business, rows, name, email, phone,
            patient=user, user=user, is_guest=user is None,
            payer_phone=payer_phone, payment_method=payment_method,
        )
        create_order_proforma(order)
        _create_order_prescription(
            business=business, order=order, patient=user,
            name=name, email=email, request=request,
        )
    except DjangoValidationError as exc:
        return Response(
            {'error': (exc.messages[0] if getattr(exc, 'messages', None) else str(exc))},
            status=400,
        )
    except (RetailProduct.DoesNotExist, ValueError) as exc:
        return Response({'error': str(exc)}, status=400)
    from .order_payment import initiate_order_payment
    from businesses import burundipay as burundipay_client
    pay_result = initiate_order_payment(order, payer_phone)
    order.refresh_from_db()
    data = RetailOrderSerializer(order).data
    data['payment_initiation'] = {
        'ok': pay_result.get('ok'),
        'already_paid': pay_result.get('already_paid', False),
        'message': pay_result.get('message') or '',
        'stub_mode': pay_result.get('stub_mode', burundipay_client.is_stub_mode()),
        'amount_bif': pay_result.get('amount_bif'),
        'merchant_account': pay_result.get('merchant_account'),
        'provider_reference': pay_result.get('provider_reference'),
    }
    return Response(data, status=201)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_proformas(request):
    business = _admin_business(request.user)
    if business:
        qs = ProformaInvoice.objects.filter(retail_business=business)
    elif request.user.role == 'CUSTOMER':
        qs = ProformaInvoice.objects.filter(patient=request.user)
    else:
        return Response({'error': 'Permission refusee.'}, status=403)
    if request.query_params.get('status'):
        qs = qs.filter(status=request.query_params['status'])
    return Response(ProformaInvoiceSerializer(qs[:100], many=True).data)


@api_view(['GET'])
@permission_classes([IsRetailPharmacyAdmin])
def retail_dashboard(request):
    business = _admin_business(request.user)
    profile = ensure_retail_profile(business)
    products = RetailProduct.objects.filter(retail_business=business)
    orders = RetailOrder.objects.filter(retail_business=business)
    active = products.filter(status='ACTIVE')
    return Response({
        'business_id': str(business.id),
        'business_name': business.name,
        'is_open_for_orders': profile.is_open_for_orders,
        'products_active': active.count(),
        'stock_value': sum(
            (product.quantity_real * product.retail_price for product in active),
            Decimal('0'),
        ),
        'low_stock_count': sum(product.stock_status == 'LOW_STOCK' for product in active),
        'out_of_stock_count': sum(product.stock_status == 'OUT_OF_STOCK' for product in active),
        'orders_total': orders.exclude(status='DRAFT').count(),
        'orders_pending': orders.filter(
            status__in=['SUBMITTED', 'PROCESSING', 'CLARIFICATION_REQUESTED']
        ).count(),
        'orders_accepted': orders.filter(status='ACCEPTED').count(),
        'orders_rejected': orders.filter(status='REJECTED').count(),
        'revenue_accepted': orders.filter(status='ACCEPTED').aggregate(
            total=Sum('total_amount')
        )['total'] or 0,
        'recent_orders': RetailOrderSerializer(orders[:8], many=True).data,
        'public_pharmacy_path': f'/businesses/{business.id}/pharmacy',
    })


@api_view(['GET'])
@permission_classes([IsRetailPharmacyAdmin])
def retail_patients(request):
    business = _admin_business(request.user)
    orders = RetailOrder.objects.filter(
        retail_business=business
    ).exclude(status='DRAFT').order_by('-created_at')
    buckets = {}
    for order in orders:
        email = order.patient_email.strip().lower()
        key = f'email:{email}'
        patient = buckets.setdefault(key, {
            'id': key,
            'name': order.patient_name,
            'email': order.patient_email,
            'phone': order.patient_phone,
            'has_account': bool(order.patient_id),
            'patient_id': str(order.patient_id) if order.patient_id else None,
            'orders_count': 0,
            'orders_pending': 0,
            'orders_accepted': 0,
            'orders_rejected': 0,
            'amount_total': Decimal('0'),
            'amount_accepted': Decimal('0'),
            'last_order_at': order.submitted_at or order.created_at,
        })
        patient['orders_count'] += 1
        patient['amount_total'] += order.total_amount
        if order.status in ('SUBMITTED', 'PROCESSING', 'CLARIFICATION_REQUESTED'):
            patient['orders_pending'] += 1
        elif order.status == 'ACCEPTED':
            patient['orders_accepted'] += 1
            patient['amount_accepted'] += order.total_amount
        elif order.status == 'REJECTED':
            patient['orders_rejected'] += 1

    query = (request.query_params.get('q') or '').strip().lower()
    data = [
        patient for patient in buckets.values()
        if not query or query in (
            f"{patient['name']} {patient['email']} {patient['phone']}".lower()
        )
    ]
    return Response(data)
