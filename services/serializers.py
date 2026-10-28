from rest_framework import serializers
from .models import Service
from service_categories.serializers import ServiceCategorySerializer


class ServiceSerializer(serializers.ModelSerializer):
    """Sérialiseur public enrichi pour l'annuaire Services."""
    category_detail = ServiceCategorySerializer(source='category', read_only=True)
    category_name = serializers.CharField(source='business.primary_category.name', read_only=True, default='')
    business_name = serializers.CharField(source='business.name', read_only=True, default='')
    business_logo = serializers.SerializerMethodField()
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

    def get_business_logo(self, obj):
        from profiles.images import display_business_logo
        return display_business_logo(obj.business)

    def get_image(self, obj):
        urls = obj.image_urls or []
        return urls[0] if urls else None

    def validate(self, data):
        return data


class AdminServiceSerializer(serializers.ModelSerializer):
    provider_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(
        source='business.primary_category.name', read_only=True, default='',
    )
    parent_title = serializers.CharField(source='parent.title', read_only=True, default='')
    sub_items = serializers.SerializerMethodField()
    grouped_services = serializers.SerializerMethodField()

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

    def get_sub_items(self, obj):
        return [
            {'id': str(item.id), 'title': item.title, 'description': item.description}
            for item in obj.sub_items.all()
        ]

    def get_grouped_services(self, obj):
        return [
            {
                'id': str(row.id),
                'title': row.title,
                'description': row.description,
                'status': row.status,
            }
            for row in obj.grouped_services.all()
        ]
