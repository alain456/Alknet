from rest_framework import serializers
from .models import Product, ProductVariant, ShopCategory, StockMovement


class ProductVariantSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'product', 'sku', 'size', 'color', 'stock', 'price_override',
            'is_active', 'label', 'unit_price', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')


class ShopCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopCategory
        fields = [
            'id', 'business', 'name', 'slug', 'description',
            'sort_order', 'is_active', 'created_at',
        ]
        read_only_fields = ('id', 'created_at')


class ProductSerializer(serializers.ModelSerializer):
    variant_rows = ProductVariantSerializer(many=True, read_only=True)
    stock_available = serializers.SerializerMethodField()
    shop_category_name = serializers.CharField(source='shop_category.name', read_only=True, default='')
    effective_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'business', 'category', 'shop_category', 'shop_category_name',
            'name', 'description', 'sku', 'price', 'discount_price', 'effective_price',
            'currency', 'stock', 'stock_available', 'low_stock_threshold',
            'image_urls', 'variants', 'extra_attributes', 'is_active',
            'variant_rows', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_stock_available(self, obj):
        return obj.stock_available()

    def get_effective_price(self, obj):
        return obj.effective_price


class AdminProductSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True, default='N/A')
    category_name = serializers.CharField(source='category.name', read_only=True, default='N/A')

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    variant_label = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            'id', 'business', 'product', 'product_name', 'variant', 'variant_label',
            'movement_type', 'quantity', 'note', 'created_at',
        ]
        read_only_fields = ('id', 'created_at')

    def get_variant_label(self, obj):
        return obj.variant.label if obj.variant_id else ''
