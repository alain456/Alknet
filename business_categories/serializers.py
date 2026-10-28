from rest_framework import serializers
from .models import BusinessCategory


def can_see_hidden_categories(request):
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    from accounts.platform_access import user_has_platform_perm
    return user_has_platform_perm(user, 'platform.catalog.update')


def wants_hidden_categories(request):
    """Masqués visibles seulement sur demande explicite (écran catalogue admin)."""
    if not request:
        return False
    flag = str(request.query_params.get('include_hidden') or '').lower() in ('1', 'true', 'yes')
    return flag and can_see_hidden_categories(request)


class BusinessCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.ReadOnlyField(source='parent.name')
    module_label = serializers.CharField(source='get_module_display', read_only=True)
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = BusinessCategory
        fields = [
            'id', 'name', 'slug', 'description', 'icon', 'parent', 'parent_name',
            'subcategories', 'module', 'module_label', 'is_visible',
            'created_at', 'updated_at',
        ]

    def create(self, validated_data):
        validated_data.setdefault('is_visible', False)
        return super().create(validated_data)

    def get_subcategories(self, obj):
        qs = obj.subcategories.all().order_by('name')
        if not wants_hidden_categories(self.context.get('request')):
            qs = qs.filter(is_visible=True)
        if not qs.exists():
            return []
        return BusinessCategorySerializer(qs, many=True, context=self.context).data
