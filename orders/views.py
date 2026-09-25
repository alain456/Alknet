from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.commerce import ensure_commerce_profile, is_commerce_business, next_order_reference
from businesses.models import Business, BusinessEmployee
from businesses.tenant import get_user_tenant_business
from products.models import Product, ProductVariant

from .models import Order, OrderItem, Cart, CartItem
from .serializers import OrderSerializer, CartSerializer, CartItemSerializer
from . import order_payment, order_workflow


def _business_staff(user, business):
    if not user or not user.is_authenticated:
        return False
    if user.role == 'BUSINESS_OWNER' and getattr(business, 'owner_id', None) == user.id:
        return True
    return BusinessEmployee.objects.filter(
        user=user, business=business, is_active=True
    ).exists()


def _notify_order_client(order, *, subject, body):
    recipient = (order.client_email or '').strip()
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


def _get_or_create_cart(request, business):
    user = request.user if request.user.is_authenticated else None
    session_key = (request.headers.get('X-Cart-Session') or request.data.get('session_key') or '').strip()
    if user:
        cart, _ = Cart.objects.get_or_create(business=business, user=user, defaults={'session_key': ''})
        return cart
    if not session_key:
        import uuid
        session_key = uuid.uuid4().hex
    cart, _ = Cart.objects.get_or_create(
        business=business, session_key=session_key, user=None,
    )
    return cart


def _decrement_stock(order):
    for item in order.items.select_related('product', 'variant'):
        if item.variant_id:
            v = item.variant
            v.stock = max(0, v.stock - item.quantity)
            v.save(update_fields=['stock', 'updated_at'])
        elif item.product_id:
            p = item.product
            p.stock = max(0, p.stock - item.quantity)
            p.save(update_fields=['stock', 'updated_at'])


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ('pay', 'confirm_payment', 'retrieve'):
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related('customer', 'business').prefetch_related('items')

        if not user.is_authenticated:
            if getattr(self, 'action', None) in ('retrieve', 'pay', 'confirm_payment'):
                return queryset
            ref = self.request.query_params.get('reference')
            if ref:
                return queryset.filter(reference_code=ref)
            return Order.objects.none()

        if user.role == 'SUPER_ADMIN':
            return Order.objects.none()
        elif user.role == 'BUSINESS_OWNER':
            queryset = queryset.filter(business__owner=user)
        elif BusinessEmployee.objects.filter(user=user, is_active=True).exists():
            queryset = queryset.filter(business__employees__user=user)
        else:
            queryset = queryset.filter(customer=user)

        business_id = self.request.query_params.get('business')
        status_param = self.request.query_params.get('status')
        if business_id:
            queryset = queryset.filter(business_id=business_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset.distinct()

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in ('COMPLETED', 'CANCELLED', 'REJECTED'):
            return Response({'error': 'Cette commande ne peut pas être annulée.'}, status=400)
        by_business = _business_staff(request.user, order.business)
        order.status = 'CANCELLED'
        order.save(update_fields=['status', 'updated_at'])
        data = OrderSerializer(order).data
        if by_business and order.client_email:
            biz = order.business.name if order.business_id else "l'établissement"
            data['email_notification'] = _notify_order_client(
                order,
                subject=f'[Isoko Hub] Commande annulée — {biz}',
                body=(
                    f'Bonjour {order.client_display_name},\n\n'
                    f'Votre commande chez {biz} (montant {order.total_amount}) a été annulée.\n\n'
                    f'— Isoko Hub\n'
                ),
            )
        return Response(data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        if not _business_staff(request.user, order.business):
            return Response({'error': 'Permission refusée.'}, status=403)
        if order.payment_status != 'PAID':
            return Response(
                {'error': 'La commande doit être payée avant acceptation.', 'code': 'payment_required'},
                status=400,
            )
        order.status = 'CONFIRMED'
        order.save(update_fields=['status', 'updated_at'])
        data = OrderSerializer(order).data
        data['email_notification'] = order_workflow.email_order_confirmed(order)
        return Response(data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        order = self.get_object()
        if not _business_staff(request.user, order.business):
            return Response({'error': 'Permission refusée.'}, status=403)
        reason = (request.data.get('reason') or '').strip()
        order.status = 'REJECTED'
        order.notes = (order.notes or '') + (f'\nRefus: {reason}' if reason else '')
        order.save(update_fields=['status', 'notes', 'updated_at'])
        data = OrderSerializer(order).data
        data['email_notification'] = order_workflow.email_order_rejected(order, reason)
        return Response(data)

    @action(detail=True, methods=['post'], url_path='mark-ready')
    def mark_ready(self, request, pk=None):
        order = self.get_object()
        if not _business_staff(request.user, order.business):
            return Response({'error': 'Permission refusée.'}, status=403)
        order.status = 'READY'
        order.save(update_fields=['status', 'updated_at'])
        data = OrderSerializer(order).data
        data['email_notification'] = order_workflow.email_order_ready(order)
        return Response(data)

    @action(detail=True, methods=['post'], url_path='mark-completed')
    def mark_completed(self, request, pk=None):
        order = self.get_object()
        if not _business_staff(request.user, order.business):
            return Response({'error': 'Permission refusée.'}, status=403)
        order.status = 'COMPLETED'
        order.save(update_fields=['status', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny])
    def pay(self, request, pk=None):
        order = self.get_object()
        phone = (request.data.get('payer_phone') or request.data.get('phone') or '').strip()
        if not phone:
            return Response({'error': 'Numéro BurundiPay requis.'}, status=400)
        result = order_payment.initiate_order_payment(order, phone)
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message'),
            'payment_status': order.payment_status,
            'provider_reference': order.payment_provider_reference,
            'order': OrderSerializer(order).data,
        }, status=200 if result.get('ok') else 400)

    @action(detail=True, methods=['post'], url_path='confirm-payment', permission_classes=[permissions.AllowAny])
    def confirm_payment(self, request, pk=None):
        order = self.get_object()
        result = order_payment.confirm_order_payment_stub(order)
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message', 'Paiement confirmé.'),
            'order': OrderSerializer(order).data,
        }, status=200 if result.get('ok') else 400)

    @action(detail=True, methods=['post'], url_path='confirm-payment-manual')
    def confirm_payment_manual(self, request, pk=None):
        order = self.get_object()
        if not _business_staff(request.user, order.business):
            return Response({'error': 'Permission refusée.'}, status=403)
        order_payment.mark_order_paid_manual(order)
        return Response(OrderSerializer(order).data)


class CartAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, business_id):
        business = Business.objects.filter(id=business_id).first()
        if not business:
            return Response({'error': 'Boutique introuvable.'}, status=404)
        cart = _get_or_create_cart(request, business)
        data = CartSerializer(cart).data
        data['session_key'] = cart.session_key
        return Response(data)

    def post(self, request, business_id):
        """Ajoute / met à jour une ligne : { product, variant?, quantity }."""
        business = Business.objects.filter(id=business_id).first()
        if not business:
            return Response({'error': 'Boutique introuvable.'}, status=404)
        if not is_commerce_business(business) and business.primary_category_id:
            # Autoriser aussi si pas encore catégorisé Commerce strict — soft
            pass
        ensure_commerce_profile(business)
        product_id = request.data.get('product')
        variant_id = request.data.get('variant')
        quantity = int(request.data.get('quantity') or 1)
        if quantity < 1:
            return Response({'error': 'Quantité invalide.'}, status=400)
        product = Product.objects.filter(id=product_id, business=business, is_active=True).first()
        if not product:
            return Response({'error': 'Produit introuvable.'}, status=404)
        variant = None
        if variant_id:
            variant = ProductVariant.objects.filter(
                id=variant_id, product=product, is_active=True,
            ).first()
            if not variant:
                return Response({'error': 'Variante introuvable.'}, status=404)
            if variant.stock < quantity:
                return Response({'error': 'Stock insuffisant pour cette variante.'}, status=400)
        else:
            # Client commerce sans variantes : stock au niveau produit
            available = product.stock_available() if hasattr(product, 'stock_available') else product.stock
            if available < quantity:
                return Response({'error': 'Stock insuffisant.'}, status=400)

        cart = _get_or_create_cart(request, business)
        item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, variant=variant,
            defaults={'quantity': quantity},
        )
        if not created:
            item.quantity = quantity
            item.save(update_fields=['quantity', 'updated_at'])
        data = CartSerializer(cart).data
        data['session_key'] = cart.session_key
        return Response(data)

    def delete(self, request, business_id):
        business = Business.objects.filter(id=business_id).first()
        if not business:
            return Response({'error': 'Boutique introuvable.'}, status=404)
        cart = _get_or_create_cart(request, business)
        item_id = request.query_params.get('item') or request.data.get('item')
        if item_id:
            CartItem.objects.filter(cart=cart, id=item_id).delete()
        else:
            cart.items.all().delete()
        data = CartSerializer(cart).data
        data['session_key'] = cart.session_key
        return Response(data)


class CheckoutAPIView(APIView):
    """Crée une commande depuis le panier (invité OK) + initie paiement optionnel."""
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request, business_id):
        business = Business.objects.filter(id=business_id).select_related('primary_category').first()
        if not business:
            return Response({'error': 'Boutique introuvable.'}, status=404)
        profile = ensure_commerce_profile(business)
        if not profile.is_open_for_orders:
            return Response({'error': 'Cette boutique a temporairement bloqué les nouvelles commandes.'}, status=400)

        cart = _get_or_create_cart(request, business)
        if not cart.items.exists():
            return Response({'error': 'Panier vide.'}, status=400)

        guest_name = (request.data.get('guest_name') or '').strip()
        guest_email = (request.data.get('guest_email') or '').strip()
        guest_phone = (request.data.get('guest_phone') or request.data.get('contact_phone') or '').strip()
        payer_phone = (request.data.get('payer_phone') or guest_phone).strip()
        notes = (request.data.get('notes') or '').strip()

        user = request.user if request.user.is_authenticated else None
        if not user and (not guest_name or not guest_phone):
            return Response({'error': 'Nom et téléphone requis pour une commande invité.'}, status=400)

        order = Order.objects.create(
            customer=user,
            business=business,
            status='PENDING',
            guest_name=guest_name if not user else '',
            guest_email=guest_email if not user else (user.email or ''),
            guest_phone=guest_phone or (getattr(user, 'phone_number', None) or ''),
            contact_phone=guest_phone or (getattr(user, 'phone_number', None) or ''),
            notes=notes,
            fulfillment_type='PICKUP',
            reference_code=next_order_reference(business),
            currency='BIF',
            payment_status='UNPAID',
        )
        total = 0
        for line in cart.items.select_related('product', 'variant'):
            price = line.unit_price
            OrderItem.objects.create(
                order=order,
                product=line.product,
                variant=line.variant,
                product_name=line.product.name,
                variant_label=line.variant.label if line.variant_id else '',
                quantity=line.quantity,
                price_at_time=price,
            )
            total += float(price) * line.quantity
        order.total_amount = total
        order.save(update_fields=['total_amount'])
        _decrement_stock(order)
        cart.items.all().delete()

        payment_result = None
        if payer_phone:
            payment_result = order_payment.initiate_order_payment(order, payer_phone)

        return Response({
            'order': OrderSerializer(order).data,
            'payment': {
                'ok': payment_result.get('ok') if payment_result else None,
                'message': payment_result.get('message') if payment_result else 'Paiement non initié',
                'payment_status': order.payment_status,
            },
        }, status=201)


class CommerceDashboardAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucune boutique.'}, status=404)
        profile = ensure_commerce_profile(business)
        from django.db.models import Sum, Count
        from django.utils import timezone
        today = timezone.now().date()
        orders = Order.objects.filter(business=business)
        paid_today = orders.filter(payment_status='PAID', paid_at__date=today).aggregate(
            total=Sum('total_amount'), count=Count('id'),
        )
        low_stock = Product.objects.filter(business=business, is_active=True).prefetch_related('variant_rows')
        low = []
        for p in low_stock:
            avail = p.stock_available()
            if avail <= p.low_stock_threshold:
                low.append({'id': str(p.id), 'name': p.name, 'stock': avail})
        return Response({
            'business_id': str(business.id),
            'business_name': business.name,
            'is_open_for_orders': profile.is_open_for_orders,
            'pickup_instructions': profile.pickup_instructions,
            'orders_pending': orders.filter(status='PENDING').count(),
            'orders_awaiting_payment': orders.filter(
                status='PENDING', payment_status__in=['UNPAID', 'AWAITING_PIN', 'FAILED'],
            ).count(),
            'orders_to_prepare': orders.filter(status='CONFIRMED', payment_status='PAID').count(),
            'orders_ready': orders.filter(status='READY').count(),
            'revenue_today': paid_today.get('total') or 0,
            'paid_orders_today': paid_today.get('count') or 0,
            'low_stock': low[:10],
            'is_commerce': is_commerce_business(business),
            'public_shop_path': f'/businesses/{business.id}/shop',
        })


class CommerceShopStatusAPIView(APIView):
    """Ouvre / ferme la boutique aux nouvelles commandes."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucune boutique.'}, status=404)
        profile = ensure_commerce_profile(business)
        return Response({
            'business_id': str(business.id),
            'is_open_for_orders': profile.is_open_for_orders,
            'pickup_instructions': profile.pickup_instructions,
            'commercial_name': profile.commercial_name or business.name,
        })

    def patch(self, request):
        business = get_user_tenant_business(request.user)
        if not business:
            return Response({'error': 'Aucune boutique.'}, status=404)
        if not _business_staff(request.user, business):
            return Response({'error': 'Non autorisé.'}, status=403)
        profile = ensure_commerce_profile(business)
        if 'is_open_for_orders' in request.data:
            profile.is_open_for_orders = bool(request.data.get('is_open_for_orders'))
        if 'pickup_instructions' in request.data:
            profile.pickup_instructions = (request.data.get('pickup_instructions') or '').strip()
        if 'commercial_name' in request.data:
            profile.commercial_name = (request.data.get('commercial_name') or '').strip()
        profile.save()
        return Response({
            'business_id': str(business.id),
            'is_open_for_orders': profile.is_open_for_orders,
            'pickup_instructions': profile.pickup_instructions,
            'commercial_name': profile.commercial_name or business.name,
            'message': (
                'Boutique ouverte aux commandes.'
                if profile.is_open_for_orders
                else 'Commandes bloquées — plus de nouvelles commandes.'
            ),
        })
