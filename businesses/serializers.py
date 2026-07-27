from rest_framework import serializers
from .models import Business, BusinessEmployee

class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ('id', 'owner', 'is_active', 'is_verified', 'created_at', 'updated_at')

class AdminBusinessSerializer(serializers.ModelSerializer):
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default="N/A")

    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ('id', 'owner', 'is_active', 'is_verified', 'created_at', 'updated_at')

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
