from rest_framework import serializers
from .models import Offer, Application

class OfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')

class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = '__all__'
        read_only_fields = ('id', 'offer', 'applicant', 'status', 'created_at', 'updated_at')
