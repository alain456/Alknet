from rest_framework import serializers
from .models import Product, ProductVariant, ShopCategory, StockMovement


class ProductVariantSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'product', 'sku', 'size', 'color', 'image_url', 'stock', 'price_override',
            'is_active', 'label', 'unit_price', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')

    def create(self, validated_data):
        from .models import StockMovement
        stock = int(validated_data.pop('stock', 0) or 0)
        variant = super().create(validated_data)
        if stock:
            variant.stock = stock
            variant.save(update_fields=['stock', 'updated_at'])
            StockMovement.objects.create(
                business=variant.product.business,
                product=variant.product,
                variant=variant,
                movement_type='IN',
                quantity=stock,
                note='Stock initial',
            )
        return variant

    def update(self, instance, validated_data):
        validated_data.pop('stock', None)
        return super().update(instance, validated_data)


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
            'name', 'description', 'sku', 'price', 'purchase_price', 'discount_price', 'effective_price',
            'currency', 'stock', 'stock_available', 'low_stock_threshold',
            'image_urls', 'variants', 'extra_attributes', 'is_active',
            'variant_rows', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_stock_available(self, obj):
        return obj.stock_available()

    def get_effective_price(self, obj):
        return obj.effective_price

    def create(self, validated_data):
        from .models import StockMovement
        stock = int(validated_data.pop('stock', 0) or 0)
        product = super().create(validated_data)
        if stock and not product.has_variants:
            product.stock = stock
            product.save(update_fields=['stock', 'updated_at'])
            StockMovement.objects.create(
                business=product.business,
                product=product,
                movement_type='IN',
                quantity=stock,
                note='Stock initial',
            )
        return product

    def update(self, instance, validated_data):
        validated_data.pop('stock', None)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self.context.get('hide_purchase_price'):
            data.pop('purchase_price', None)
        return data


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
