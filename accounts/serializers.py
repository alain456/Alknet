# pyrefly: ignore [missing-import]
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .services import create_user

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'phone_number', 'role', 'is_email_verified', 'created_at')
        read_only_fields = ('id', 'role', 'is_email_verified', 'created_at')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, default='CUSTOMER')

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'phone_number', 'role')

    def create(self, validated_data):
        user = create_user(**validated_data)
        return user
