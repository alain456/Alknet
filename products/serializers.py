from rest_framework import serializers
from .models import Product

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')

class AdminProductSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True, default="N/A")
    category_name = serializers.CharField(source='category.name', read_only=True, default="N/A")

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
