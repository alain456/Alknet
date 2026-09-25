
from decimal import Decimal
from rest_framework import serializers
from .models import (
    WholesalePharmacyProfile, WholesaleProduct, StockMovement,
    WholesaleOrder, WholesaleOrderItem, WholesaleOrderEvent,
    WholesaleCart, WholesaleCartItem, NotificationLog, ProformaInvoice,
)


class WholesaleProfileSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_id = serializers.UUIDField(source='business.id', read_only=True)
    logo = serializers.CharField(source='business.logo', read_only=True)
    phone = serializers.CharField(source='business.phone', read_only=True)
    email = serializers.EmailField(source='business.email', read_only=True)
    address = serializers.CharField(source='business.address', read_only=True)
    commune = serializers.CharField(source='business.commune', read_only=True)
    description = serializers.CharField(source='business.description', read_only=True)
    website = serializers.URLField(source='business.website', read_only=True, required=False, allow_blank=True)

    class Meta:
        model = WholesalePharmacyProfile
        fields = [
            'id', 'business_id', 'business_name', 'commercial_name', 'license_number',
            'status', 'order_reference_prefix', 'acceptance_email_message',
            'logo', 'phone', 'email', 'address', 'commune', 'description', 'website',
            'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')


class WholesaleProductSerializer(serializers.ModelSerializer):
    quantity_available = serializers.IntegerField(read_only=True)
    stock_status = serializers.CharField(read_only=True)
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = WholesaleProduct
        fields = [
            'id', 'wholesale_business', 'name', 'active_ingredient', 'dosage',
            'pharmaceutical_form', 'administration_route', 'manufacturer',
            'packaging', 'wholesale_unit', 'min_order_quantity',
            'wholesale_price', 'currency', 'quantity_real', 'quantity_reserved',
            'quantity_available', 'low_stock_threshold', 'batch_number',
            'expiration_date', 'status', 'description', 'therapeutic_class', 'image_url', 'stock_status',
            'price_display', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'wholesale_business', 'quantity_reserved', 'created_at', 'updated_at')

    def get_price_display(self, obj):
        return f'{obj.wholesale_price} {obj.currency} / {obj.packaging}'


class WholesaleProductPublicSerializer(serializers.ModelSerializer):
    """Catalogue client — sans stock reel / reserve."""
    quantity_available = serializers.IntegerField(read_only=True)
    stock_status = serializers.CharField(read_only=True)
    availability = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = WholesaleProduct
        fields = [
            'id', 'name', 'active_ingredient', 'dosage', 'pharmaceutical_form',
            'administration_route', 'manufacturer', 'packaging', 'wholesale_unit',
            'min_order_quantity', 'wholesale_price', 'currency', 'price_display',
            'availability', 'quantity_available', 'stock_status', 'description', 'therapeutic_class', 'image_url', 'status',
        ]

    def get_availability(self, obj):
        if obj.status != 'ACTIVE' or obj.quantity_available <= 0:
            return 'Rupture'
        if obj.stock_status == 'LOW_STOCK':
            return 'Stock faible'
        return 'Disponible'

    def get_price_display(self, obj):
        return f'{obj.wholesale_price} {obj.currency} / {obj.packaging}'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Ne pas exposer le chiffre exact de stock si on veut seulement Disponible/Rupture
        # On garde quantity_available pour plafonner le panier, mais on peut le masquer cote UI.
        return data


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'old_quantity', 'new_quantity',
            'difference', 'reason', 'user', 'user_email', 'order', 'created_at',
        ]


class WholesaleOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WholesaleOrderItem
        fields = [
            'id', 'product', 'product_name_snapshot', 'packaging_snapshot',
            'wholesale_unit_snapshot', 'unit_price_snapshot', 'quantity', 'line_total',
        ]


class WholesaleOrderEventSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = WholesaleOrderEvent
        fields = ['id', 'event_type', 'message', 'user', 'user_email', 'created_at']


class NotificationLogSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = NotificationLog
        fields = [
            'id', 'order', 'recipient_business', 'recipient_email', 'notification_type',
            'status', 'status_label', 'sent_at', 'error_message', 'created_at',
        ]

    def get_status_label(self, obj):
        return {
            'PENDING': 'Email en attente',
            'SENT': 'Email envoye',
            'FAILED': "Echec de l'envoi",
        }.get(obj.status, obj.status)


class ProformaInvoiceSerializer(serializers.ModelSerializer):
    client_business_name = serializers.CharField(source='client_business.name', read_only=True)
    wholesale_business_name = serializers.CharField(source='wholesale_business.name', read_only=True)
    status_label = serializers.SerializerMethodField()
    order_reference = serializers.CharField(source='order.reference', read_only=True, allow_null=True)

    class Meta:
        model = ProformaInvoice
        fields = [
            'id', 'reference', 'cart', 'order', 'order_reference',
            'client_business', 'client_business_name',
            'wholesale_business', 'wholesale_business_name',
            'status', 'status_label', 'subtotal', 'total', 'currency',
            'lines_snapshot', 'generated_at', 'confirmed_at', 'created_at', 'updated_at',
        ]

    def get_status_label(self, obj):
        return {
            'DRAFT': 'Brouillon',
            'PENDING_VALIDATION': 'En attente de validation',
            'CONFIRMED': 'Confirmee',
            'CANCELLED': 'Annulee',
            'REJECTED': 'Refusee',
        }.get(obj.status, obj.status)


class WholesaleOrderSerializer(serializers.ModelSerializer):
    items = WholesaleOrderItemSerializer(many=True, read_only=True)
    events = WholesaleOrderEventSerializer(many=True, read_only=True)
    notification_logs = NotificationLogSerializer(many=True, read_only=True)
    proforma = ProformaInvoiceSerializer(read_only=True)
    client_business_name = serializers.SerializerMethodField()
    buyer_label = serializers.SerializerMethodField()
    wholesale_business_name = serializers.CharField(source='wholesale_business.name', read_only=True)
    items_count = serializers.SerializerMethodField()
    email_status = serializers.SerializerMethodField()
    client_contact_name = serializers.SerializerMethodField()
    client_email = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()

    class Meta:
        model = WholesaleOrder
        fields = [
            'id', 'reference', 'wholesale_business', 'wholesale_business_name',
            'client_business', 'client_business_name', 'client_contact_name',
            'client_email', 'client_phone', 'buyer_type', 'buyer_name',
            'buyer_email', 'buyer_phone', 'buyer_label', 'created_by', 'status',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_merchant_account', 'payment_provider_reference', 'payment_note',
            'paid_at', 'paid_by',
            'total_amount', 'currency', 'refusal_reason', 'refusal_comment',
            'notification_email', 'accepted_by', 'accepted_at', 'refused_by',
            'refused_at', 'submitted_at', 'items', 'events', 'notification_logs',
            'proforma', 'email_status', 'items_count', 'created_at', 'updated_at',
        ]
        read_only_fields = (
            'id', 'reference', 'total_amount', 'accepted_by', 'accepted_at',
            'refused_by', 'refused_at', 'submitted_at', 'created_at', 'updated_at',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_merchant_account', 'payment_provider_reference', 'payment_note',
            'paid_at', 'paid_by',
        )

    def get_items_count(self, obj):
        return obj.items.count()

    def get_client_business_name(self, obj):
        if obj.client_business_id:
            return obj.client_business.name
        return obj.buyer_name or 'Client externe'

    def get_buyer_label(self, obj):
        return 'Pharmacie de detail' if obj.buyer_type == 'RETAIL_PHARMACY' else 'Personne'

    def get_email_status(self, obj):
        log = obj.notification_logs.order_by('-created_at').first()
        if not log:
            return None
        return {
            'status': log.status,
            'label': {
                'PENDING': 'Email en attente',
                'SENT': 'Email envoye',
                'FAILED': "Echec de l'envoi",
            }.get(log.status, log.status),
            'recipient_email': log.recipient_email,
            'sent_at': log.sent_at,
            'error_message': log.error_message,
        }

    def get_client_contact_name(self, obj):
        if obj.created_by_id:
            u = obj.created_by
            return (f'{getattr(u, "first_name", "")} {getattr(u, "last_name", "")}'.strip()
                    or getattr(u, 'email', '') or '')
        return obj.buyer_name or ''

    def get_client_email(self, obj):
        if obj.client_business_id and obj.client_business.email:
            return obj.client_business.email
        return obj.notification_email or obj.buyer_email or ''

    def get_client_phone(self, obj):
        if obj.client_business_id and obj.client_business.phone:
            return obj.client_business.phone
        return obj.buyer_phone or ''


class WholesaleCartItemSerializer(serializers.ModelSerializer):
    product_detail = WholesaleProductPublicSerializer(source='product', read_only=True)
    line_total = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()
    validation_error = serializers.SerializerMethodField()

    class Meta:
        model = WholesaleCartItem
        fields = [
            'id', 'product', 'product_detail', 'product_name_snapshot',
            'packaging_snapshot', 'wholesale_unit_snapshot', 'unit_price_snapshot',
            'quantity', 'line_total', 'is_valid', 'validation_error', 'updated_at',
        ]

    def get_line_total(self, obj):
        price = obj.unit_price_snapshot or obj.product.wholesale_price
        return price * obj.quantity

    def get_is_valid(self, obj):
        return self.get_validation_error(obj) is None

    def get_validation_error(self, obj):
        p = obj.product
        if p.status != 'ACTIVE':
            return 'Produit inactif'
        if obj.quantity < 1:
            return 'Quantite minimale: 1'
        if obj.quantity < p.min_order_quantity:
            return f'Quantite minimale: {p.min_order_quantity}'
        if obj.quantity > p.quantity_available:
            return f'Stock insuffisant (dispo: {p.quantity_available})'
        if p.quantity_available <= 0:
            return 'Produit en rupture'
        return None


class WholesaleCartSerializer(serializers.ModelSerializer):
    items = WholesaleCartItemSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    wholesale_business_name = serializers.CharField(source='wholesale_business.name', read_only=True)
    client_business_name = serializers.CharField(source='client_business.name', read_only=True)
    currency = serializers.SerializerMethodField()
    has_errors = serializers.SerializerMethodField()
    proforma = serializers.SerializerMethodField()

    class Meta:
        model = WholesaleCart
        fields = [
            'id', 'client_business', 'client_business_name',
            'wholesale_business', 'wholesale_business_name',
            'items', 'subtotal', 'total_amount', 'currency',
            'has_errors', 'proforma', 'updated_at', 'created_at',
        ]

    def get_currency(self, obj):
        return 'BIF'

    def get_total_amount(self, obj):
        total = Decimal('0')
        for i in obj.items.select_related('product'):
            price = i.unit_price_snapshot or i.product.wholesale_price
            total += price * i.quantity
        return total

    def get_subtotal(self, obj):
        return self.get_total_amount(obj)

    def get_has_errors(self, obj):
        ser = WholesaleCartItemSerializer()
        return any(ser.get_validation_error(i) for i in obj.items.select_related('product'))

    def get_proforma(self, obj):
        from .order_workflow import sync_draft_proforma
        # Prefer existing draft without always rewriting on every serialize if empty
        proforma = (
            ProformaInvoice.objects.filter(cart=obj, status='DRAFT')
            .order_by('-generated_at')
            .first()
        )
        if obj.items.exists():
            proforma = sync_draft_proforma(obj)
        if not proforma:
            return None
        return ProformaInvoiceSerializer(proforma).data
