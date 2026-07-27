from rest_framework import serializers
from .models import Service
from service_categories.serializers import ServiceCategorySerializer

class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = '__all__'
        read_only_fields = ('id', 'professional', 'rating', 'reviews_count', 'created_at', 'updated_at')

    def validate(self, data):
        # La logique d'association à un Business vs Professional se fait dans la vue
        return data

class AdminServiceSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True, default=None)
    professional_email = serializers.CharField(source='professional.email', read_only=True, default=None)
    category_name = serializers.CharField(source='category.name', read_only=True, default="N/A")

    class Meta:
        model = Service
        fields = '__all__'
        read_only_fields = ('id', 'professional', 'rating', 'reviews_count', 'created_at', 'updated_at')
