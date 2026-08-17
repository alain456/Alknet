from rest_framework import serializers
from .models import BusinessCategory

class BusinessCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.ReadOnlyField(source='parent.name')
    subcategories = serializers.SerializerMethodNested(read_only=True) if hasattr(serializers, 'SerializerMethodNested') else serializers.SerializerMethodField()

    class Meta:
        model = BusinessCategory
        fields = ['id', 'name', 'slug', 'description', 'icon', 'parent', 'parent_name', 'subcategories', 'created_at', 'updated_at']

    def get_subcategories(self, obj):
        if obj.subcategories.exists():
            return BusinessCategorySerializer(obj.subcategories.all(), many=True).data
        return []
