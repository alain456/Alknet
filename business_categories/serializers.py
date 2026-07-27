from rest_framework import serializers
from .models import BusinessCategory

class BusinessCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessCategory
        fields = '__all__'
