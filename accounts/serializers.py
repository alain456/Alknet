# pyrefly: ignore [missing-import]
from rest_framework import serializers
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .services import create_user

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    staff_category = serializers.SerializerMethodField()
    system_access_level = serializers.SerializerMethodField()
    business_info = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'phone_number', 'role', 'is_email_verified', 'is_active', 'staff_category', 'system_access_level', 'business_info', 'created_at')
        read_only_fields = ('id', 'role', 'is_email_verified', 'created_at')

    def get_staff_category(self, obj):
        if hasattr(obj, 'doctor_profile') and obj.doctor_profile:
            return obj.doctor_profile.staff_category
        return None

    def get_system_access_level(self, obj):
        emp = obj.employments.first() if hasattr(obj, 'employments') else None
        if emp and emp.role:
            return emp.role.system_access_level
        return None

    def get_business_info(self, obj):
        owned = obj.businesses.first() if hasattr(obj, 'businesses') else None
        if owned:
            return {
                'id': str(owned.id),
                'name': owned.name,
                'relationship': 'OWNER',
                'role_name': 'Propriétaire',
                'permissions': ['*'],
                'category_name': owned.primary_category.name if owned.primary_category_id else '',
                'category_slug': owned.primary_category.slug if owned.primary_category_id else '',
            }
        emp = obj.employments.first() if hasattr(obj, 'employments') else None
        if emp and emp.business:
            return {
                'id': str(emp.business.id),
                'name': emp.business.name,
                'relationship': 'EMPLOYEE',
                'role_name': emp.role.name if emp.role else (emp.position or 'Employé'),
                'system_access_level': emp.role.system_access_level if emp.role else None,
                'permissions': emp.role.permissions if emp.role else [],
                'category_name': emp.business.primary_category.name if emp.business.primary_category_id else '',
                'category_slug': emp.business.primary_category.slug if emp.business.primary_category_id else '',
            }
        if hasattr(obj, 'doctor_profile') and obj.doctor_profile and obj.doctor_profile.hospital:
            h = obj.doctor_profile.hospital
            return {
                'id': str(h.id),
                'name': h.name,
                'relationship': 'DOCTOR',
                'role_name': obj.doctor_profile.staff_category or 'Médecin',
                'category_name': h.primary_category.name if h.primary_category_id else 'Santé',
            }
        return None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    # The role is no longer accepted from the client, it is forced to CUSTOMER

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'phone_number')

    def create(self, validated_data):
        validated_data['role'] = 'CUSTOMER'
        user = create_user(**validated_data)
        return user


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=True)
    business_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    business_relationship = serializers.CharField(required=False, default='EMPLOYEE', write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'phone_number', 'role', 'business_id', 'business_relationship')

    def create(self, validated_data):
        business_id = validated_data.pop('business_id', None)
        business_rel = validated_data.pop('business_relationship', 'EMPLOYEE')
        user = create_user(**validated_data)
        if business_id:
            from businesses.models import Business, BusinessEmployee
            business = Business.objects.filter(id=business_id).first()
            if business:
                if business_rel == 'OWNER':
                    business.owner = user
                    business.save()
                else:
                    BusinessEmployee.objects.create(user=user, business=business)
        return user

class AdminUserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password], allow_blank=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False)
    business_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    business_relationship = serializers.CharField(required=False, default='EMPLOYEE', write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'phone_number', 'role', 'is_active', 'business_id', 'business_relationship')
        read_only_fields = ('email',)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        business_id = validated_data.pop('business_id', 'NOT_PROVIDED')
        business_rel = validated_data.pop('business_relationship', 'EMPLOYEE')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        if business_id != 'NOT_PROVIDED':
            from businesses.models import Business, BusinessEmployee
            # Clear existing employment for user
            BusinessEmployee.objects.filter(user=instance).delete()

            if business_id:
                business = Business.objects.filter(id=business_id).first()
                if business:
                    if business_rel == 'OWNER':
                        business.owner = instance
                        business.save()
                    else:
                        BusinessEmployee.objects.create(user=instance, business=business)

        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        from .models import AuditLog
        model = AuditLog
        fields = (
            'id', 'user', 'user_email', 'user_name', 'user_role',
            'action', 'resource', 'ip_address', 'user_agent',
            'status', 'details', 'created_at'
        )

    def get_user_name(self, obj):
        if obj.user:
            full_name = obj.user.get_full_name()
            if full_name and full_name != obj.user.email:
                return full_name
        return obj.user_email or 'Utilisateur inconnu'


