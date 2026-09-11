from rest_framework import serializers
from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    business_name = serializers.CharField(source='business.name', read_only=True, allow_null=True)
    service_title = serializers.CharField(source='service.title', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'customer', 'customer_name', 'business', 'business_name',
            'professional', 'service', 'service_title', 'scheduled_date',
            'status', 'status_display', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['customer', 'created_at', 'updated_at']

    def get_customer_name(self, obj):
        return obj.customer.get_full_name()
