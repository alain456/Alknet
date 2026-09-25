# pyrefly: ignore [missing-import]
from rest_framework import serializers
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from .services import create_user

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    staff_category = serializers.SerializerMethodField()
    system_access_level = serializers.SerializerMethodField()
    business_info = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    platform_permissions = serializers.SerializerMethodField()
    platform_role_code = serializers.SerializerMethodField()
    platform_role_name = serializers.SerializerMethodField()
    platform_roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'phone_number', 'role',
            'is_email_verified', 'is_active', 'staff_category', 'system_access_level',
            'business_info', 'avatar', 'created_at', 'platform_permissions',
            'platform_role_code', 'platform_role_name', 'platform_roles',
        )
        read_only_fields = ('id', 'role', 'is_email_verified', 'created_at')

    def get_avatar(self, obj):
        profile = getattr(obj, 'profile', None)
        if not profile:
            return ''
        v = (profile.avatar or '').strip()
        if not v:
            return ''
        if v.startswith('http') or v.startswith('data:image/'):
            # Limite payload admin : images trop lourdes → signaler présence sans renvoyer
            if v.startswith('data:image/') and len(v) > 500_000:
                return ''
            return v
        return ''

    def get_platform_permissions(self, obj):
        from .platform_access import permissions_for_user
        return permissions_for_user(obj)

    def get_platform_role_code(self, obj):
        from .platform_access import ROLE_TO_CODE
        return ROLE_TO_CODE.get(obj.role)

    def get_platform_role_name(self, obj):
        from .platform_access import ROLE_TO_CODE, role_label_for_user
        if obj.role not in ROLE_TO_CODE:
            return None
        return role_label_for_user(obj)

    def get_platform_roles(self, obj):
        from .platform_access import ROLE_TO_CODE, ensure_platform_roles, role_name_for_code
        if obj.role not in ROLE_TO_CODE and not getattr(obj, 'is_superuser', False):
            return []
        ensure_platform_roles()
        return [
            {'code': code, 'name': role_name_for_code(code)}
            for code in ('super_admin', 'finance', 'moderation', 'support', 'content')
        ]

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
            permissions = ['*']
            system_access_level = None
            # Hôtel : permissions PMS du rôle « Propriétaire » (Rôles & Permissions)
            cat_name = (owned.primary_category.name if owned.primary_category_id else '') or ''
            cat_slug = (owned.primary_category.slug if owned.primary_category_id else '') or ''
            if any(k in cat_name.lower() or k in cat_slug.lower() for k in ('hôtel', 'hotel', 'hôtellerie', 'hotellerie')):
                try:
                    from hotel.role_defaults import get_hotel_owner_role
                    owner_role = get_hotel_owner_role(owned)
                    if owner_role:
                        permissions = list(owner_role.permissions or []) or ['hotel.manage', 'hotel.owner']
                        # Garantit le plein PMS côté UI pour le propriétaire du business
                        if 'hotel.manage' not in permissions:
                            permissions = list(dict.fromkeys([*permissions, 'hotel.manage', 'hotel.owner']))
                        system_access_level = owner_role.system_access_level
                except Exception:
                    permissions = ['hotel.manage', 'hotel.owner']
            return {
                'id': str(owned.id),
                'name': owned.name,
                'relationship': 'OWNER',
                'role_name': 'Propriétaire',
                'permissions': permissions,
                'system_access_level': system_access_level,
                'category_name': cat_name,
                'category_slug': cat_slug,
            }
        emp = obj.employments.first() if hasattr(obj, 'employments') else None
        if emp and emp.business:
            return {
                'id': str(emp.business.id),
                'name': emp.business.name,
                'relationship': 'EMPLOYEE',
                'role_name': emp.role.name if emp.role else (emp.position or 'Employé'),
                'position': emp.position or '',
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


def _save_user_avatar(user, avatar_value):
    """Enregistre l'avatar sur le profil (URL ou data:image). Chaîne vide = effacer."""
    from profiles.models import Profile
    profile, _ = Profile.objects.get_or_create(user=user)
    value = (avatar_value or '').strip()
    if value and not (
        value.startswith('http://')
        or value.startswith('https://')
        or value.startswith('data:image/')
    ):
        raise serializers.ValidationError({'avatar': 'Image invalide (URL ou fichier image).'})
    profile.avatar = value
    profile.save(update_fields=['avatar'])


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=True)
    business_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    business_relationship = serializers.CharField(required=False, default='EMPLOYEE', write_only=True)
    avatar = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = (
            'email', 'password', 'first_name', 'last_name', 'phone_number', 'role',
            'business_id', 'business_relationship', 'avatar',
        )

    def create(self, validated_data):
        avatar = validated_data.pop('avatar', '')
        business_id = validated_data.pop('business_id', None)
        business_rel = validated_data.pop('business_relationship', 'EMPLOYEE')
        user = create_user(**validated_data)
        if avatar:
            _save_user_avatar(user, avatar)
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
    avatar = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = (
            'email', 'password', 'first_name', 'last_name', 'phone_number', 'role', 'is_active',
            'business_id', 'business_relationship', 'avatar',
        )

    def validate_email(self, value):
        from .email_identity import normalize_login_email, get_user_by_login_email
        email = normalize_login_email(value)
        if not email or '@' not in email:
            raise serializers.ValidationError('Email obligatoire.')
        existing = get_user_by_login_email(email)
        if existing and (not self.instance or existing.pk != self.instance.pk):
            raise serializers.ValidationError('Un compte utilise déjà cette adresse email.')
        return email

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        business_id = validated_data.pop('business_id', 'NOT_PROVIDED')
        business_rel = validated_data.pop('business_relationship', 'EMPLOYEE')
        avatar = validated_data.pop('avatar', 'NOT_PROVIDED')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        if avatar != 'NOT_PROVIDED':
            _save_user_avatar(instance, avatar)

        if business_id != 'NOT_PROVIDED':
            from businesses.models import Business, BusinessEmployee
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
        # Normaliser l'email AVANT l'auth Django (égalité stricte via get_by_natural_key)
        from .email_identity import normalize_login_email
        raw = attrs.get(self.username_field) or attrs.get('email') or ''
        attrs[self.username_field] = normalize_login_email(raw)
        if 'email' in attrs:
            attrs['email'] = attrs[self.username_field]
        data = super().validate(attrs)
        # Filet de sécurité : le token ne doit jamais être émis pour un autre email
        from .email_identity import emails_strictly_equal
        if not emails_strictly_equal(self.user.email, attrs[self.username_field]):
            from rest_framework_simplejwt.exceptions import AuthenticationFailed
            raise AuthenticationFailed(
                'Email de connexion incorrect (correspondance stricte requise).',
                'no_matching_email',
            )
        data['user'] = UserSerializer(self.user).data
        return data


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    user_role_label = serializers.SerializerMethodField()
    created_at_utc = serializers.SerializerMethodField()
    impersonation = serializers.SerializerMethodField()
    changes = serializers.SerializerMethodField()
    error_code = serializers.SerializerMethodField()
    error_message = serializers.SerializerMethodField()
    geo_location = serializers.SerializerMethodField()
    event_category = serializers.SerializerMethodField()

    class Meta:
        from .models import AuditLog
        model = AuditLog
        fields = (
            'id', 'user', 'user_id', 'user_email', 'user_name', 'user_role', 'user_role_label',
            'action', 'resource', 'ip_address', 'user_agent',
            'status', 'details', 'created_at', 'created_at_utc',
            'impersonation', 'changes', 'error_code', 'error_message',
            'geo_location', 'event_category',
        )

    def get_user_name(self, obj):
        if obj.user:
            full_name = obj.user.get_full_name()
            if full_name and full_name != obj.user.email:
                return full_name
        return obj.user_email or 'Utilisateur inconnu'

    def get_user_id(self, obj):
        if obj.user_id:
            return str(obj.user_id)
        details = obj.details or {}
        return details.get('user_id') or details.get('actor_id') or None

    def get_user_role_label(self, obj):
        from .platform_access import role_label_from_role_key
        return role_label_from_role_key(obj.user_role) or obj.user_role or '—'

    def get_created_at_utc(self, obj):
        if not obj.created_at:
            return None
        from datetime import timezone as dt_timezone
        dt = obj.created_at
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, dt_timezone.utc)
        return dt.astimezone(dt_timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')

    def _details(self, obj):
        return obj.details if isinstance(obj.details, dict) else {}

    def get_impersonation(self, obj):
        d = self._details(obj)
        if not (d.get('impersonation') or d.get('impersonated_by') or d.get('acting_as') or d.get('on_behalf_of')):
            return None
        return {
            'active': True,
            'impersonated_by': d.get('impersonated_by') or d.get('support_actor') or d.get('actor_email'),
            'on_behalf_of': d.get('on_behalf_of') or d.get('acting_as') or obj.user_email,
            'reason': d.get('impersonation_reason') or d.get('reason') or '',
        }

    def get_changes(self, obj):
        d = self._details(obj)
        if d.get('changes') and isinstance(d['changes'], dict):
            return d['changes']
        old_v = d.get('old_value', d.get('old', d.get('before')))
        new_v = d.get('new_value', d.get('new', d.get('after')))
        if old_v is None and new_v is None:
            return None
        return {'old': old_v, 'new': new_v}

    def get_error_code(self, obj):
        if obj.status != 'FAILED':
            return None
        d = self._details(obj)
        return d.get('error_code') or d.get('code') or None

    def get_error_message(self, obj):
        if obj.status != 'FAILED':
            return None
        d = self._details(obj)
        return d.get('error_message') or d.get('error') or d.get('message') or None

    def get_geo_location(self, obj):
        d = self._details(obj)
        if d.get('geo_location'):
            return d['geo_location']
        parts = [d.get('city'), d.get('country') or d.get('country_code')]
        label = ', '.join([p for p in parts if p])
        return label or d.get('location') or None

    def get_event_category(self, obj):
        action = (obj.action or '').upper()
        resource = (obj.resource or '').upper()
        d = self._details(obj)
        if d.get('event_category'):
            return d['event_category']
        if any(k in action for k in ('LOGIN', 'LOGOUT', 'PASSWORD', '2FA', 'MFA', 'OTP')):
            return 'ACCESS'
        if any(k in action for k in ('ROLE', 'PERMISSION', 'RBAC', 'INVITE', 'ADMIN')):
            return 'SECURITY'
        if any(k in action for k in ('BILLING', 'SUBSCRIPTION', 'PAYMENT', 'PLAN', 'INVOICE')):
            return 'BILLING'
        if any(k in action for k in ('EXPORT', 'DOWNLOAD', 'CSV', 'REPORT')) or 'EXPORT' in resource:
            return 'DATA_EXPORT'
        if any(k in action for k in ('API_KEY', 'WEBHOOK', 'INTEGRATION', 'OAUTH')):
            return 'INTEGRATIONS'
        if any(k in action for k in ('CREATE', 'UPDATE', 'DELETE', 'MODIFY')):
            return 'DATA_CHANGE'
        return 'OTHER'



