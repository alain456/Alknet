from rest_framework import serializers
from products.models import Product, ProductVariant
from .models import Order, OrderItem, Cart, CartItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'variant', 'product_name', 'variant_label',
            'quantity', 'price_at_time',
        ]


class OrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    business_name = serializers.CharField(source='business.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    items_data = OrderItemSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_name', 'business', 'business_name',
            'status', 'status_display', 'total_amount', 'currency',
            'guest_name', 'guest_email', 'guest_phone',
            'fulfillment_type', 'shipping_address', 'contact_phone', 'notes',
            'reference_code',
            'payment_status', 'payment_status_display', 'payment_method',
            'payer_phone', 'payment_merchant_account', 'payment_provider_reference',
            'payment_note', 'paid_at',
            'items', 'items_data',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'customer', 'total_amount', 'reference_code', 'payment_status',
            'payment_method', 'payment_merchant_account', 'payment_provider_reference',
            'payment_note', 'paid_at', 'created_at', 'updated_at',
        ]

    def get_customer_name(self, obj):
        return obj.client_display_name

    def create(self, validated_data):
        items_data = validated_data.pop('items_data', [])
        request = self.context['request']
        if request.user and request.user.is_authenticated:
            validated_data['customer'] = request.user
        order = Order.objects.create(**validated_data)
        total = 0
        for item in items_data:
            OrderItem.objects.create(order=order, **item)
            total += item['quantity'] * item['price_at_time']
        order.total_amount = total
        order.save(update_fields=['total_amount'])
        return order


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    variant_label = serializers.SerializerMethodField()
    unit_price = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            'id', 'product', 'product_name', 'variant', 'variant_label',
            'quantity', 'unit_price', 'line_total', 'image_url',
        ]

    def get_variant_label(self, obj):
        return obj.variant.label if obj.variant_id else ''

    def get_unit_price(self, obj):
        return obj.unit_price

    def get_line_total(self, obj):
        return obj.unit_price * obj.quantity

    def get_image_url(self, obj):
        urls = obj.product.image_urls or []
        return urls[0] if urls else ''


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()
    business_name = serializers.CharField(source='business.name', read_only=True)

    class Meta:
        model = Cart
        fields = [
            'id', 'business', 'business_name', 'session_key',
            'items', 'total', 'updated_at',
        ]

    def get_total(self, obj):
        return obj.recalculate()
