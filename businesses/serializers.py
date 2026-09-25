from rest_framework import serializers
from .models import Business, BusinessEmployee, BusinessRole
from .subscription import subscription_summary, ensure_business_subscription

from business_categories.serializers import BusinessCategorySerializer

class BusinessLiteSerializer(serializers.ModelSerializer):
    """Payload léger pour /businesses/me/ — évite les réponses multi-Mo (502)."""
    primary_category_name = serializers.CharField(
        source='primary_category.name', read_only=True, default='Non spécifiée'
    )
    has_logo = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()
    subscription = serializers.SerializerMethodField()
    burundipay_merchant_account = serializers.CharField(
        source='lumicash_merchant_account', required=False, allow_blank=True
    )

    class Meta:
        model = Business
        fields = (
            'id', 'name', 'description', 'phone', 'email', 'website', 'address',
            'province', 'commune', 'zone', 'quartier', 'avenue',
            'latitude', 'longitude', 'proof_document',
            'lumicash_merchant_account', 'burundipay_merchant_account', 'extra_attributes',
            'is_active', 'is_verified',
            'verification_status', 'primary_category', 'primary_category_name',
            'logo', 'has_logo', 'subscription',
        )
        read_only_fields = fields

    def get_has_logo(self, obj):
        return bool(obj.logo and str(obj.logo).strip())

    def get_logo(self, obj):
        """Retourne le logo si URL ou data:image compressée (≤ ~300 Ko)."""
        v = (obj.logo or '').strip()
        if not v:
            return ''
        if v.startswith(('http://', 'https://', '/media/', '/static/')):
            return v
        if v.startswith('data:image/') and len(v) <= 400_000:
            return v
        # Trop volumineux pour /me/ : le front garde has_logo=True et ne doit pas écraser
        return ''

    def get_subscription(self, obj):
        ensure_business_subscription(obj)
        return subscription_summary(obj)


class BusinessSerializer(serializers.ModelSerializer):
    primary_category_detail = BusinessCategorySerializer(source='primary_category', read_only=True)
    primary_category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    categories_detail = BusinessCategorySerializer(source='categories', many=True, read_only=True)
    full_address = serializers.ReadOnlyField()
    burundipay_merchant_account = serializers.CharField(
        source='lumicash_merchant_account', required=False, allow_blank=True
    )
    category_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False
    )

    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ('id', 'owner', 'is_active', 'is_verified', 'created_at', 'updated_at')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['accepted_insurances'] = self._merged_accepted_insurances(instance)
        # Alias public BurundiPay (colonne DB historique lumicash_merchant_account)
        data['burundipay_merchant_account'] = instance.lumicash_merchant_account or ''
        cat = getattr(instance, 'primary_category', None)
        data['primary_category_slug'] = getattr(cat, 'slug', None) or ''
        data['primary_category_name'] = (
            data.get('primary_category_name')
            or getattr(cat, 'name', None)
            or 'Non spécifiée'
        )
        parent = getattr(cat, 'parent', None) if cat else None
        data['primary_category_parent_name'] = getattr(parent, 'name', None) or ''
        return data

    @staticmethod
    def _merged_accepted_insurances(obj):
        extras = obj.extra_attributes if isinstance(obj.extra_attributes, dict) else {}
        from_extra = extras.get('insurances') or extras.get('accepted_insurances') or []
        try:
            from_profile = obj.hospital_profile.accepted_insurances or []
        except Exception:
            from_profile = []
        seen = set()
        merged = []
        for item in list(from_extra) + list(from_profile):
            label = str(item or '').strip()
            if not label or label.lower() in seen:
                continue
            seen.add(label.lower())
            merged.append(label)
        return merged

    def update(self, instance, validated_data):
        category_ids = validated_data.pop('category_ids', None)
        # Ne pas effacer le logo si le client envoie une chaîne vide par erreur
        # (ex: payload sans logo chargé depuis Lite). Envoyer explicitement '' via clear_logo.
        if 'logo' in validated_data:
            logo_val = validated_data.get('logo')
            if logo_val is None or (isinstance(logo_val, str) and not logo_val.strip()):
                if not self.context.get('request') or not (
                    str(self.context['request'].data.get('clear_logo', '')).lower()
                    in ('1', 'true', 'yes')
                ):
                    validated_data.pop('logo', None)
        instance = super().update(instance, validated_data)
        if category_ids is not None:
            instance.categories.set(category_ids)
        self._sync_hospital_accepted_insurances(instance)
        return instance

    @staticmethod
    def _sync_hospital_accepted_insurances(business):
        """Aligne HospitalProfile.accepted_insurances sur extra_attributes.insurances."""
        extras = business.extra_attributes if isinstance(business.extra_attributes, dict) else {}
        if 'insurances' not in extras and 'accepted_insurances' not in extras:
            return
        insurances = extras.get('insurances') or extras.get('accepted_insurances') or []
        if not isinstance(insurances, list):
            return
        try:
            profile = business.hospital_profile
        except Exception:
            return
        cleaned = [str(x).strip() for x in insurances if str(x or '').strip()]
        if profile.accepted_insurances != cleaned:
            profile.accepted_insurances = cleaned
            profile.save(update_fields=['accepted_insurances', 'updated_at'])

class AdminBusinessSerializer(serializers.ModelSerializer):
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    owner_first_name = serializers.CharField(source='owner.first_name', read_only=True)
    owner_last_name = serializers.CharField(source='owner.last_name', read_only=True)
    owner_avatar = serializers.SerializerMethodField()
    owner_email_input = serializers.EmailField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    owner_avatar_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, source='_owner_avatar_input'
    )
    primary_category_detail = BusinessCategorySerializer(source='primary_category', read_only=True)
    primary_category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    category_name = serializers.CharField(source='primary_category.name', read_only=True, default="Non spécifiée")
    categories_detail = BusinessCategorySerializer(source='categories', many=True, read_only=True)
    full_address = serializers.ReadOnlyField()
    category_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False
    )
    subscription = serializers.SerializerMethodField()
    commerce_compliance = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = '__all__'
        read_only_fields = ('id', 'owner', 'created_at', 'updated_at')

    def get_owner_avatar(self, obj):
        try:
            return (obj.owner.profile.avatar or '') if obj.owner_id else ''
        except Exception:
            return ''

    def get_subscription(self, obj):
        return subscription_summary(obj)

    def get_commerce_compliance(self, obj):
        try:
            p = obj.commerce_profile
        except Exception:
            return None
        if not (p.nif_number or p.rccm_number or p.permit_number):
            return None
        return {
            'nif_number': p.nif_number,
            'rccm_number': p.rccm_number,
            'permit_number': p.permit_number,
            'nif_document': p.nif_document or '',
            'rccm_document': p.rccm_document or '',
            'permit_document': p.permit_document or '',
            'has_nif_document': bool(p.nif_document),
            'has_rccm_document': bool(p.rccm_document),
            'has_permit_document': bool(p.permit_document),
        }

    def to_internal_value(self, data):
        # Alias client : owner_avatar → owner_avatar_input
        if hasattr(data, 'copy'):
            data = data.copy()
            if 'owner_avatar' in data and 'owner_avatar_input' not in data:
                data['owner_avatar_input'] = data.get('owner_avatar')
        elif isinstance(data, dict):
            data = {**data}
            if 'owner_avatar' in data and 'owner_avatar_input' not in data:
                data['owner_avatar_input'] = data.get('owner_avatar')
        return super().to_internal_value(data)

    def _apply_owner_avatar(self, user, avatar):
        avatar = (avatar or '').strip()
        if not avatar:
            return
        if not (
            avatar.startswith('http://')
            or avatar.startswith('https://')
            or avatar.startswith('data:image/')
        ):
            return
        from profiles.models import Profile
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.avatar = avatar
        profile.save(update_fields=['avatar'])

    def _apply_commerce_if_needed(self, business, raw_data, *, required=True):
        from .commerce import (
            is_commerce_category,
            validate_commerce_registration_documents,
            find_commerce_document_duplicates,
            apply_commerce_compliance,
            normalize_registry_number,
            hash_document_payload,
        )
        primary = business.primary_category
        if primary and getattr(primary, 'parent_id', None):
            primary = type(primary).objects.select_related('parent').get(pk=primary.pk)
        if not is_commerce_category(primary):
            return
        data = raw_data if isinstance(raw_data, dict) else {}
        extras = data.get('extra_attributes') or {}
        if not isinstance(extras, dict):
            extras = {}
        has_docs = bool(
            (data.get('nif_document') or extras.get('nif_document') or '').strip()
            or (data.get('nif_number') or extras.get('nif_number') or '').strip()
        )
        if not required and not has_docs:
            return
        doc_errors = validate_commerce_registration_documents(data)
        if doc_errors:
            raise serializers.ValidationError({'error': ' '.join(doc_errors)})
        nif = normalize_registry_number(data.get('nif_number') or extras.get('nif_number') or '')
        nif_doc = (data.get('nif_document') or extras.get('nif_document') or '').strip()
        dup_errors = find_commerce_document_duplicates(
            nif=nif,
            nif_hash=hash_document_payload(nif_doc),
            exclude_business_id=business.id,
        )
        if dup_errors:
            raise serializers.ValidationError({'error': ' '.join(dup_errors)})
        apply_commerce_compliance(business, data)

    def create(self, validated_data):
        category_ids = validated_data.pop('category_ids', [])
        owner_email = validated_data.pop('owner_email_input', None)
        password = (validated_data.pop('password', None) or '').strip()
        first_name = (validated_data.pop('first_name', None) or '').strip()
        last_name = (validated_data.pop('last_name', None) or '').strip()
        owner_avatar = (validated_data.pop('_owner_avatar_input', None) or '').strip()
        raw = self.initial_data if isinstance(self.initial_data, dict) else {}

        from django.contrib.auth import get_user_model
        from accounts.email_identity import normalize_login_email, get_user_by_login_email
        User = get_user_model()

        if owner_email:
            email = normalize_login_email(owner_email)
            user = get_user_by_login_email(email)
            if user is None:
                if not password or len(password) < 6:
                    raise serializers.ValidationError({
                        'password': 'Mot de passe requis (au moins 6 caractères).',
                    })
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    role='BUSINESS_OWNER',
                    first_name=first_name or validated_data.get('name', 'Propriétaire'),
                    last_name=last_name or '',
                    is_active=True,
                )
            else:
                if first_name:
                    user.first_name = first_name
                if last_name:
                    user.last_name = last_name
                if password and len(password) >= 6:
                    user.set_password(password)
                if user.role != 'BUSINESS_OWNER':
                    user.role = 'BUSINESS_OWNER'
                user.save()
            validated_data['owner'] = user
            if not validated_data.get('email'):
                validated_data['email'] = email
            self._apply_owner_avatar(user, owner_avatar or raw.get('owner_avatar'))
        elif 'owner' not in validated_data:
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                validated_data['owner'] = request.user

        # Création admin : approuvée et active par défaut
        validated_data.setdefault('verification_status', 'APPROVED')
        validated_data.setdefault('is_verified', True)
        validated_data.setdefault('is_active', True)

        business = super().create(validated_data)
        if category_ids:
            business.categories.set(category_ids)
        try:
            self._apply_commerce_if_needed(business, raw, required=True)
        except serializers.ValidationError:
            business.delete()
            raise
        return business

    def update(self, instance, validated_data):
        category_ids = validated_data.pop('category_ids', None)
        validated_data.pop('owner_email_input', None)
        password = (validated_data.pop('password', None) or '').strip()
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        owner_avatar = (validated_data.pop('_owner_avatar_input', None) or '').strip()
        raw = self.initial_data if isinstance(self.initial_data, dict) else {}

        instance = super().update(instance, validated_data)
        if category_ids is not None:
            instance.categories.set(category_ids)

        owner = instance.owner
        if owner:
            changed = False
            if first_name is not None and str(first_name).strip():
                owner.first_name = str(first_name).strip()
                changed = True
            if last_name is not None and str(last_name).strip():
                owner.last_name = str(last_name).strip()
                changed = True
            if password and len(password) >= 6:
                owner.set_password(password)
                changed = True
            if changed:
                owner.save()
            self._apply_owner_avatar(owner, owner_avatar or raw.get('owner_avatar'))

        self._apply_commerce_if_needed(instance, raw, required=False)
        return instance

class BusinessRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessRole
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'business')

class BusinessEmployeeSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_access_level = serializers.CharField(source='role.system_access_level', read_only=True)
    
    # We allow inputting an email and role_id to create an employee
    email = serializers.EmailField(write_only=True, required=False)
    role_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = BusinessEmployee
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'user', 'business')
        
    def create(self, validated_data):
        email = validated_data.pop('email', None)
        role_id = validated_data.pop('role_id', None)
        if email:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(email=email)
                validated_data['user'] = user
            except User.DoesNotExist:
                raise serializers.ValidationError({"email": "Aucun utilisateur trouvé avec cet e-mail."})
        return super().create(validated_data)
