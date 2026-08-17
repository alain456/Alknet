from rest_framework import serializers
from .models import Business, BusinessEmployee

from business_categories.serializers import BusinessCategorySerializer

class BusinessSerializer(serializers.ModelSerializer):
    primary_category_detail = BusinessCategorySerializer(source='primary_category', read_only=True)
    primary_category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    categories_detail = BusinessCategorySerializer(source='categories', many=True, read_only=True)
    category_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False
    )

    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ('id', 'owner', 'is_active', 'is_verified', 'created_at', 'updated_at')

    def update(self, instance, validated_data):
        category_ids = validated_data.pop('category_ids', None)
        instance = super().update(instance, validated_data)
        if category_ids is not None:
            instance.categories.set(category_ids)
        return instance

class AdminBusinessSerializer(serializers.ModelSerializer):
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    owner_email_input = serializers.EmailField(write_only=True, required=False)
    primary_category_detail = BusinessCategorySerializer(source='primary_category', read_only=True)
    primary_category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    categories_detail = BusinessCategorySerializer(source='categories', many=True, read_only=True)
    category_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False
    )

    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ('id', 'owner', 'created_at', 'updated_at')

    def create(self, validated_data):
        category_ids = validated_data.pop('category_ids', [])
        owner_email = validated_data.pop('owner_email_input', None)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        if owner_email:
            user, created = User.objects.get_or_create(
                email=owner_email,
                defaults={
                    'role': 'BUSINESS_OWNER',
                    'first_name': validated_data.get('name', 'Propriétaire'),
                    'is_active': True
                }
            )
            if created:
                user.set_password('Isoko123!')
                user.save()
            validated_data['owner'] = user
        elif 'owner' not in validated_data:
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                validated_data['owner'] = request.user

        business = super().create(validated_data)
        if category_ids:
            business.categories.set(category_ids)
        return business

    def update(self, instance, validated_data):
        category_ids = validated_data.pop('category_ids', None)
        instance = super().update(instance, validated_data)
        if category_ids is not None:
            instance.categories.set(category_ids)
        return instance

class BusinessEmployeeSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    
    # We allow inputting an email to create an employee
    email = serializers.EmailField(write_only=True, required=False)

    class Meta:
        model = BusinessEmployee
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'user', 'business')
        
    def create(self, validated_data):
        email = validated_data.pop('email', None)
        if email:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(email=email)
                validated_data['user'] = user
            except User.DoesNotExist:
                raise serializers.ValidationError({"email": "Aucun utilisateur trouvé avec cet e-mail."})
        return super().create(validated_data)
