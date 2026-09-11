from decimal import Decimal

from rest_framework import serializers

from .models import (
    NotificationLog,
    Prescription,
    ProformaInvoice,
    RetailCart,
    RetailCartItem,
    RetailOrder,
    RetailOrderEvent,
    RetailOrderItem,
    RetailPharmacyProfile,
    RetailProduct,
    StockMovement,
)


class RetailProfileSerializer(serializers.ModelSerializer):
    business_id = serializers.UUIDField(source='business.id', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    logo = serializers.CharField(source='business.logo', read_only=True)
    phone = serializers.CharField(source='business.phone', read_only=True)
    email = serializers.EmailField(source='business.email', read_only=True)
    address = serializers.CharField(source='business.address', read_only=True)
    commune = serializers.CharField(source='business.commune', read_only=True)
    description = serializers.CharField(source='business.description', read_only=True)

    class Meta:
        model = RetailPharmacyProfile
        fields = [
            'id', 'business_id', 'business_name', 'commercial_name', 'license_number',
            'status', 'order_reference_prefix', 'acceptance_email_message',
            'is_open_for_orders', 'logo',
            'phone', 'email', 'address', 'commune', 'description',
            'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'business_id', 'created_at', 'updated_at')


class RetailProductSerializer(serializers.ModelSerializer):
    quantity_available = serializers.IntegerField(read_only=True)
    stock_status = serializers.CharField(read_only=True)
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = RetailProduct
        fields = [
            'id', 'retail_business', 'name', 'active_ingredient', 'dosage',
            'pharmaceutical_form', 'administration_route', 'manufacturer',
            'packaging', 'sales_unit', 'retail_price', 'currency',
            'prescription_required', 'quantity_real', 'quantity_reserved',
            'quantity_available', 'low_stock_threshold', 'batch_number',
            'expiration_date', 'status', 'description', 'therapeutic_class',
            'image_url', 'stock_status', 'price_display', 'created_at', 'updated_at',
        ]
        read_only_fields = (
            'id', 'retail_business', 'quantity_reserved', 'created_at', 'updated_at',
        )

    def get_price_display(self, obj):
        return f'{obj.retail_price} {obj.currency} / {obj.sales_unit}'


class RetailProductPublicSerializer(serializers.ModelSerializer):
    quantity_available = serializers.IntegerField(read_only=True)
    stock_status = serializers.CharField(read_only=True)
    availability = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()

    class Meta:
        model = RetailProduct
        fields = [
            'id', 'retail_business', 'name', 'active_ingredient', 'dosage',
            'pharmaceutical_form', 'administration_route', 'manufacturer',
            'packaging', 'sales_unit', 'retail_price', 'currency',
            'prescription_required', 'quantity_available', 'stock_status',
            'availability', 'price_display', 'description', 'therapeutic_class',
            'expiration_date', 'image_url', 'status',
        ]

    def get_availability(self, obj):
        if obj.status != 'ACTIVE' or obj.quantity_available <= 0:
            return 'Rupture'
        return 'Stock faible' if obj.stock_status == 'LOW_STOCK' else 'Disponible'

    def get_price_display(self, obj):
        return f'{obj.retail_price} {obj.currency} / {obj.sales_unit}'


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'old_quantity', 'new_quantity',
            'difference', 'reason', 'user', 'user_email', 'order', 'created_at',
        ]


class RetailOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetailOrderItem
        fields = [
            'id', 'product', 'product_name_snapshot', 'packaging_snapshot',
            'sales_unit_snapshot', 'unit_price_snapshot',
            'prescription_required_snapshot', 'quantity', 'line_total',
        ]


class RetailOrderEventSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = RetailOrderEvent
        fields = ['id', 'event_type', 'message', 'user', 'user_email', 'created_at']


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = [
            'id', 'recipient_email', 'notification_type', 'status',
            'sent_at', 'error_message', 'created_at',
        ]


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_account_email = serializers.EmailField(source='patient.email', read_only=True)
    reviewed_by_email = serializers.EmailField(source='reviewed_by.email', read_only=True)
    order_reference = serializers.CharField(source='order.reference', read_only=True)

    class Meta:
        model = Prescription
        fields = [
            'id', 'retail_business', 'order', 'order_reference', 'patient',
            'patient_account_email', 'patient_name', 'patient_email', 'file_url',
            'status', 'review_comment', 'reviewed_by', 'reviewed_by_email',
            'reviewed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'patient', 'status', 'review_comment', 'reviewed_by',
            'reviewed_at', 'created_at', 'updated_at',
        ]


class ProformaInvoiceSerializer(serializers.ModelSerializer):
    retail_business_name = serializers.CharField(source='retail_business.name', read_only=True)
    order_reference = serializers.CharField(source='order.reference', read_only=True)

    class Meta:
        model = ProformaInvoice
        fields = [
            'id', 'reference', 'cart', 'order', 'order_reference', 'patient',
            'patient_name', 'patient_email', 'retail_business',
            'retail_business_name', 'status', 'subtotal', 'total', 'currency',
            'lines_snapshot', 'generated_at', 'confirmed_at',
            'created_at', 'updated_at',
        ]


class RetailOrderSerializer(serializers.ModelSerializer):
    items = RetailOrderItemSerializer(many=True, read_only=True)
    events = RetailOrderEventSerializer(many=True, read_only=True)
    notification_logs = NotificationLogSerializer(many=True, read_only=True)
    prescriptions = PrescriptionSerializer(many=True, read_only=True)
    proforma = ProformaInvoiceSerializer(read_only=True)
    retail_business_name = serializers.CharField(source='retail_business.name', read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = RetailOrder
        fields = [
            'id', 'reference', 'retail_business', 'retail_business_name',
            'patient', 'patient_name', 'patient_email', 'patient_phone', 'is_guest',
            'created_by', 'status', 'payment_status', 'payment_method', 'payer_phone',
            'payment_merchant_account', 'payment_provider_reference', 'payment_note',
            'paid_at', 'paid_by', 'total_amount', 'currency', 'rejection_reason',
            'rejection_comment', 'clarification_comment', 'notification_email',
            'accepted_by', 'accepted_at', 'rejected_by', 'rejected_at',
            'submitted_at', 'items', 'items_count', 'events', 'prescriptions',
            'notification_logs', 'proforma', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'reference', 'patient', 'is_guest', 'created_by', 'status',
            'payment_status', 'payment_method', 'payer_phone',
            'payment_merchant_account', 'payment_provider_reference', 'payment_note',
            'paid_at', 'paid_by',
            'total_amount', 'accepted_by', 'accepted_at', 'rejected_by',
            'rejected_at', 'submitted_at', 'created_at', 'updated_at',
        ]

    def get_items_count(self, obj):
        return obj.items.count()


class RetailCartItemSerializer(serializers.ModelSerializer):
    product_detail = RetailProductPublicSerializer(source='product', read_only=True)
    line_total = serializers.SerializerMethodField()
    validation_error = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = RetailCartItem
        fields = [
            'id', 'product', 'product_detail', 'product_name_snapshot',
            'packaging_snapshot', 'sales_unit_snapshot', 'unit_price_snapshot',
            'quantity', 'line_total', 'validation_error', 'is_valid', 'updated_at',
        ]

    def get_line_total(self, obj):
        return (obj.unit_price_snapshot or obj.product.retail_price) * obj.quantity

    def get_validation_error(self, obj):
        if obj.product.status != 'ACTIVE':
            return 'Produit inactif'
        if obj.quantity < 1:
            return 'Quantite minimale: 1'
        if obj.quantity > obj.product.quantity_available:
            return f'Stock insuffisant (dispo: {obj.product.quantity_available})'
        return None

    def get_is_valid(self, obj):
        return self.get_validation_error(obj) is None


class RetailCartSerializer(serializers.ModelSerializer):
    items = RetailCartItemSerializer(many=True, read_only=True)
    retail_business_name = serializers.CharField(source='retail_business.name', read_only=True)
    total_amount = serializers.SerializerMethodField()
    has_errors = serializers.SerializerMethodField()
    proforma = serializers.SerializerMethodField()

    class Meta:
        model = RetailCart
        fields = [
            'id', 'patient', 'retail_business', 'retail_business_name',
            'items', 'total_amount', 'has_errors', 'proforma',
            'created_at', 'updated_at',
        ]

    def get_total_amount(self, obj):
        return sum(
            (
                (item.unit_price_snapshot or item.product.retail_price) * item.quantity
                for item in obj.items.select_related('product')
            ),
            Decimal('0'),
        )

    def get_has_errors(self, obj):
        serializer = RetailCartItemSerializer()
        return any(
            serializer.get_validation_error(item)
            for item in obj.items.select_related('product')
        )

    def get_proforma(self, obj):
        from .order_workflow import sync_draft_proforma
        proforma = sync_draft_proforma(obj) if obj.items.exists() else None
        return ProformaInvoiceSerializer(proforma).data if proforma else None
