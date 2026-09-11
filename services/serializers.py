from rest_framework import serializers
from .models import Service
from service_categories.serializers import ServiceCategorySerializer


class ServiceSerializer(serializers.ModelSerializer):
    """Sérialiseur public enrichi pour l'annuaire Services."""
    category_detail = ServiceCategorySerializer(source='category', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default='')
    business_name = serializers.CharField(source='business.name', read_only=True, default='')
    business_logo = serializers.CharField(source='business.logo', read_only=True, default='')
    business_address = serializers.CharField(source='business.address', read_only=True, default='')
    provider_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    name = serializers.CharField(source='title', read_only=True)

    class Meta:
        model = Service
        fields = '__all__'
        read_only_fields = ('id', 'professional', 'rating', 'reviews_count', 'created_at', 'updated_at')

    def get_provider_name(self, obj):
        if obj.business:
            return obj.business.name
        if obj.professional:
            return (
                f"{obj.professional.first_name} {obj.professional.last_name}".strip()
                or obj.professional.email
            )
        return 'Prestataire'

    def get_image(self, obj):
        urls = obj.image_urls or []
        return urls[0] if urls else None

    def validate(self, data):
        return data


class AdminServiceSerializer(serializers.ModelSerializer):
    provider_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True, default='N/A')

    class Meta:
        model = Service
        fields = '__all__'
        read_only_fields = ('id', 'professional', 'rating', 'reviews_count', 'created_at', 'updated_at')

    def get_provider_name(self, obj):
        if obj.business:
            return obj.business.name
        if obj.professional:
            return (
                f"{obj.professional.first_name} {obj.professional.last_name}".strip()
                or obj.professional.email
            )
        return 'Unknown'
