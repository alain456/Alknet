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
