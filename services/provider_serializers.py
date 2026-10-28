import re

from rest_framework import serializers

from profiles.images import display_business_logo
from .media import persist_document_file, persist_offer_images, persist_team_photo
from .permissions import services_tenant_business

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import (
    ContactMessage,
    ContactRequest,
    ProviderDocument,
    Service,
    ServiceProviderProfile,
    ServiceSubItem,
    TeamMember,
)


_MAX_DATA_URL = 800_000
_MAX_VIDEO_DATA_URL = 1_800_000
_IMAGE_PREFIXES = (
    'data:image/jpeg',
    'data:image/jpg',
    'data:image/png',
    'data:image/webp',
)
_VIDEO_PREFIXES = (
    'data:video/mp4',
    'data:video/webm',
)
_YOUTUBE_RE = re.compile(
    r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube(?:-nocookie)?\.com/embed/|youtube\.com/shorts/)([A-Za-z0-9_-]{11})',
)
_VIMEO_RE = re.compile(r'vimeo\.com/(?:video/)?(\d+)')


def _plain_text(value, limit=255):
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', value or '').strip()
    return text[:limit]


def _public_media_path(url):
    path = (url or '').strip().split('?', 1)[0]
    if path.startswith('/media/public/') and '..' not in path:
        return path
    return ''


def _validate_image_url(url):
    text = url.strip() if isinstance(url, str) else ''
    if not text:
        return ''
    media_path = _public_media_path(text)
    if media_path:
        return media_path
    if text.startswith('data:image/'):
        if not text.startswith(_IMAGE_PREFIXES):
            raise serializers.ValidationError('Formats acceptés : JPG, PNG, WebP.')
        if len(text) > _MAX_DATA_URL:
            raise serializers.ValidationError('Image trop lourde. Compressez-la avant l’envoi.')
    elif text.startswith('http://') or text.startswith('https://'):
        if len(text) > 2000:
            raise serializers.ValidationError('URL d’image invalide.')
    else:
        raise serializers.ValidationError('Image invalide.')
    return text


def _validate_video_url(url):
    text = url.strip() if isinstance(url, str) else ''
    if not text:
        return ''
    media_path = _public_media_path(text)
    if media_path:
        return media_path
    if text.startswith('data:video/'):
        if not text.startswith(_VIDEO_PREFIXES):
            raise serializers.ValidationError('Formats vidéo acceptés : MP4 ou WebM.')
        if len(text) > _MAX_VIDEO_DATA_URL:
            raise serializers.ValidationError('Vidéo trop lourde. Utilisez un lien YouTube ou un fichier plus court.')
        return text
    if not (text.startswith('http://') or text.startswith('https://')):
        raise serializers.ValidationError('Lien vidéo invalide.')
    if len(text) > 2000:
        raise serializers.ValidationError('URL de vidéo invalide.')
    lowered = text.lower()
    if _YOUTUBE_RE.search(text) or _VIMEO_RE.search(text):
        return text
    if lowered.endswith(('.mp4', '.webm', '.ogg')) or 'video' in lowered:
        return text
    raise serializers.ValidationError('Lien YouTube, Vimeo ou fichier MP4/WebM attendu.')


def _visible_offers(profile):
    rows = list(profile.business.services.all()) if profile.business_id else []
    grouping_ids = {row.parent_id for row in rows if row.parent_id}
    return [row for row in rows if row.id not in grouping_ids]


class ServiceSubItemSerializer(serializers.ModelSerializer):
    title = serializers.CharField(max_length=255, allow_blank=True)

    class Meta:
        model = ServiceSubItem
        fields = ['id', 'title', 'description', 'sort_order']
        read_only_fields = ('id',)


class PublicOfferSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='business.primary_category.name', read_only=True, default='')
    parent_title = serializers.CharField(source='parent.title', read_only=True, default='')
    sub_items = ServiceSubItemSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()
    provider_id = serializers.UUIDField(source='business_id', read_only=True)
    provider_name = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            'id', 'title', 'description', 'modalities', 'availability',
            'coverage_zone', 'location', 'category', 'category_name',
            'parent', 'parent_title',
            'sub_items', 'image', 'image_urls', 'provider_id', 'provider_name',
            'status', 'sort_order',
        ]

    def get_image(self, obj):
        urls = persist_offer_images(obj)
        return urls[0] if urls else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        urls = persist_offer_images(instance)
        data['image_urls'] = urls
        data['image'] = urls[0] if urls else None
        return data

    def get_provider_name(self, obj):
        profile = getattr(obj.business, 'service_provider_profile', None)
        if profile:
            return profile.display_name()
        return obj.business.name if obj.business_id else ''


class MerchantOfferSerializer(serializers.ModelSerializer):
    sub_items = ServiceSubItemSerializer(many=True, required=False)
    category_name = serializers.CharField(source='business.primary_category.name', read_only=True, default='')
    parent_title = serializers.CharField(source='parent.title', read_only=True, default='')

    class Meta:
        model = Service
        fields = [
            'id', 'title', 'description', 'modalities', 'availability',
            'coverage_zone', 'location', 'category', 'category_name',
            'parent', 'parent_title',
            'status', 'image_urls', 'tags', 'sub_items', 'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')
        extra_kwargs = {
            'category': {'required': False, 'allow_null': True},
            'parent': {'required': False, 'allow_null': True},
        }

    def validate_category(self, value):
        return value or None

    def validate_parent(self, value):
        return value or None

    def validate_sub_items(self, value):
        return [row for row in (value or []) if (row.get('title') or '').strip()]

    def validate_coverage_zone(self, value):
        return _plain_text(value)

    def validate_availability(self, value):
        return _plain_text(value)

    def validate_location(self, value):
        return _plain_text(value)

    def validate_image_urls(self, value):
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Liste d’images invalide.')
        if len(value) > 5:
            raise serializers.ValidationError('Cinq images maximum par service.')
        cleaned = []
        for raw in value:
            if not isinstance(raw, str) or not raw.strip():
                continue
            cleaned.append(_validate_image_url(raw))
        return cleaned

    def validate(self, attrs):
        attrs = super().validate(attrs)
        parent = attrs['parent'] if 'parent' in attrs else getattr(self.instance, 'parent', None)
        if not parent:
            return attrs
        if self.instance and parent.pk == self.instance.pk:
            raise serializers.ValidationError({'parent': 'Un service ne peut pas se regrouper lui-même.'})
        if parent.parent_id:
            raise serializers.ValidationError({'parent': 'Choisissez un service de regroupement, pas un service déjà groupé.'})
        request = self.context.get('request')
        business = services_tenant_business(request.user) if request and request.user else None
        if self.instance and self.instance.business_id:
            business = business or self.instance.business
        if business and parent.business_id and parent.business_id != business.id:
            raise serializers.ValidationError({'parent': 'Le regroupement doit appartenir à votre entreprise.'})
        if self.instance and parent and self.instance.grouped_services.exists():
            raise serializers.ValidationError({'parent': 'Ce service regroupe déjà d’autres services.'})
        return attrs

    def create(self, validated_data):
        from .grouping import drop_obsolete_parent_items

        items = validated_data.pop('sub_items', [])
        offer = super().create(validated_data)
        if offer.parent_id or not offer.grouped_services.exists():
            self._replace_items(offer, items)
        drop_obsolete_parent_items(offer)
        persist_offer_images(offer)
        return offer

    def update(self, instance, validated_data):
        from .grouping import drop_obsolete_parent_items

        items = validated_data.pop('sub_items', None)
        offer = super().update(instance, validated_data)
        if items is not None and (offer.parent_id or not offer.grouped_services.exists()):
            offer.sub_items.all().delete()
            self._replace_items(offer, items)
        drop_obsolete_parent_items(offer)
        persist_offer_images(offer)
        return offer

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['image_urls'] = persist_offer_images(instance)
        return data

    def _replace_items(self, offer, items):
        for index, row in enumerate(items or []):
            title = (row.get('title') or '').strip()
            if not title:
                continue
            ServiceSubItem.objects.create(
                service=offer,
                title=title,
                description=row.get('description') or '',
                sort_order=row.get('sort_order') if row.get('sort_order') is not None else index,
            )


class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = [
            'id', 'name', 'role_title', 'qualifications', 'experience',
            'photo_url', 'is_public', 'sort_order',
        ]
        read_only_fields = ('id',)

    def validate_name(self, value):
        return _plain_text(value)

    def validate_role_title(self, value):
        return _plain_text(value)

    def validate_photo_url(self, value):
        return _validate_image_url(value)

    def create(self, validated_data):
        member = super().create(validated_data)
        persist_team_photo(member)
        return member

    def update(self, instance, validated_data):
        member = super().update(instance, validated_data)
        persist_team_photo(member)
        return member

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['photo_url'] = persist_team_photo(instance)
        return data


class ProviderDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderDocument
        fields = [
            'id', 'title', 'kind', 'description', 'file_url',
            'is_public', 'sort_order', 'created_at',
        ]
        read_only_fields = ('id', 'created_at')

    def validate_title(self, value):
        return _plain_text(value)

    def validate_description(self, value):
        return _plain_text(value, 2000)

    def validate_kind(self, value):
        kind = (value or 'ACTIVITY').strip().upper()
        if kind not in dict(ProviderDocument.KIND_CHOICES):
            raise serializers.ValidationError('Type de justificatif invalide.')
        return kind

    def validate(self, attrs):
        attrs = super().validate(attrs)
        kind = attrs.get('kind') or getattr(self.instance, 'kind', 'ACTIVITY')
        file_url = attrs['file_url'] if 'file_url' in attrs else getattr(self.instance, 'file_url', '')
        if kind in {'ACTIVITY', 'ATTESTATION', 'CERTIFICATE'}:
            try:
                attrs['file_url'] = _validate_image_url(file_url)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'file_url': exc.detail}) from exc
            if not attrs['file_url'] and self.instance is None:
                labels = {
                    'ACTIVITY': 'Ajoutez une photo de l’activité.',
                    'ATTESTATION': 'Ajoutez l’image de l’attestation.',
                    'CERTIFICATE': 'Ajoutez l’image du certificat.',
                }
                raise serializers.ValidationError({'file_url': labels[kind]})
        elif kind == 'TESTIMONY':
            try:
                attrs['file_url'] = _validate_video_url(file_url)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'file_url': exc.detail}) from exc
            if not attrs['file_url']:
                raise serializers.ValidationError({'file_url': 'Ajoutez une vidéo ou un lien de témoignage.'})
        elif 'file_url' in attrs:
            text = (file_url or '').strip()
            media_path = _public_media_path(text)
            if media_path:
                attrs['file_url'] = media_path
            elif text and not (text.startswith('http://') or text.startswith('https://') or text.startswith('data:')):
                raise serializers.ValidationError({'file_url': 'Lien de fichier invalide.'})
            else:
                attrs['file_url'] = text[:4000]
        return attrs

    def create(self, validated_data):
        document = super().create(validated_data)
        persist_document_file(document)
        return document

    def update(self, instance, validated_data):
        document = super().update(instance, validated_data)
        persist_document_file(document)
        return document

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['file_url'] = persist_document_file(instance)
        return data


class ProviderProfileSerializer(serializers.ModelSerializer):
    business_id = serializers.UUIDField(source='business.id', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    category_name = serializers.CharField(source='business.primary_category.name', read_only=True, default='')
    category_id = serializers.UUIDField(source='business.primary_category_id', required=False, allow_null=True)
    phone = serializers.CharField(source='business.phone', required=False, allow_blank=True)
    email = serializers.EmailField(source='business.email', required=False, allow_blank=True)
    website = serializers.CharField(source='business.website', required=False, allow_blank=True)
    address = serializers.CharField(source='business.address', required=False, allow_blank=True)
    commune = serializers.CharField(source='business.commune', required=False, allow_blank=True)
    province = serializers.CharField(source='business.province', required=False, allow_blank=True)
    zone = serializers.CharField(source='business.zone', required=False, allow_blank=True)
    quartier = serializers.CharField(source='business.quartier', required=False, allow_blank=True)
    avenue = serializers.CharField(source='business.avenue', required=False, allow_blank=True)
    latitude = serializers.FloatField(source='business.latitude', required=False, allow_null=True)
    longitude = serializers.FloatField(source='business.longitude', required=False, allow_null=True)
    logo = serializers.SerializerMethodField()

    class Meta:
        model = ServiceProviderProfile
        fields = [
            'id', 'business_id', 'business_name', 'commercial_name', 'about',
            'coverage_zones', 'opening_hours',
            'show_phone', 'show_email', 'show_address', 'show_website',
            'is_published', 'phone', 'email', 'website', 'address',
            'commune', 'province', 'zone', 'quartier', 'avenue',
            'latitude', 'longitude', 'category_name', 'category_id', 'logo',
        ]
        read_only_fields = ('id', 'business_id', 'business_name', 'category_name', 'logo')

    def get_logo(self, obj):
        return display_business_logo(obj.business)

    def update(self, instance, validated_data):
        category_id = None
        if 'business' in validated_data and 'primary_category_id' in validated_data['business']:
            category_id = validated_data['business'].pop('primary_category_id')
        business_data = validated_data.pop('business', {})
        profile = super().update(instance, validated_data)
        business = instance.business
        update_fields = []
        if business_data:
            for field, value in business_data.items():
                setattr(business, field, value)
            update_fields.extend(business_data.keys())
        if category_id:
            from business_categories.services_sector import assign_prepared_service_category
            category, error = assign_prepared_service_category(category_id)
            if error:
                raise serializers.ValidationError({'category_id': error})
            business.primary_category = category
            business.category = category
            update_fields.extend(['primary_category', 'category'])
        if update_fields:
            business.save(update_fields=list(dict.fromkeys(update_fields)) + ['updated_at'])
        return profile


class PublicProviderSerializer(serializers.ModelSerializer):
    business_id = serializers.UUIDField(source='business.id', read_only=True)
    name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='business.primary_category.name', read_only=True, default='')
    category_slug = serializers.CharField(source='business.primary_category.slug', read_only=True, default='')
    category_id = serializers.UUIDField(source='business.primary_category_id', read_only=True)
    logo = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    website = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    commune = serializers.CharField(source='business.commune', read_only=True)
    province = serializers.CharField(source='business.province', read_only=True)
    offers = serializers.SerializerMethodField()
    team = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()

    class Meta:
        model = ServiceProviderProfile
        fields = [
            'id', 'business_id', 'name', 'about', 'coverage_zones', 'opening_hours',
            'category_id', 'category_name', 'category_slug', 'logo', 'phone', 'email', 'website',
            'address', 'commune', 'province', 'offers', 'team', 'documents',
        ]

    def get_name(self, obj):
        return obj.display_name()

    def get_logo(self, obj):
        return display_business_logo(obj.business)

    def get_phone(self, obj):
        return obj.business.phone if obj.show_phone else ''

    def get_email(self, obj):
        return obj.business.email if obj.show_email else ''

    def get_website(self, obj):
        return obj.business.website if obj.show_website else ''

    def get_address(self, obj):
        if not obj.show_address:
            return ''
        return obj.business.full_address or obj.business.address

    def get_offers(self, obj):
        rows = [
            row for row in obj.business.services.all()
            if getattr(row, 'status', 'ACTIVE') == 'ACTIVE'
        ]
        rows.sort(key=lambda row: (row.sort_order, row.title or ''))
        return PublicOfferSerializer(rows, many=True).data

    def get_team(self, obj):
        rows = [row for row in obj.business.service_team.all() if row.is_public]
        return TeamMemberSerializer(rows, many=True).data

    def get_documents(self, obj):
        rows = [row for row in obj.business.service_documents.all() if row.is_public]
        return ProviderDocumentSerializer(rows, many=True).data


class PublicProviderListSerializer(PublicProviderSerializer):
    offer_count = serializers.SerializerMethodField()
    sample_offers = serializers.SerializerMethodField()

    class Meta(PublicProviderSerializer.Meta):
        fields = [
            'id', 'business_id', 'name', 'about', 'coverage_zones', 'opening_hours',
            'category_id', 'category_name', 'category_slug', 'logo', 'phone', 'email',
            'website', 'address', 'commune', 'province',
            'offer_count', 'sample_offers',
        ]

    def get_offer_count(self, obj):
        return len(_visible_offers(obj))

    def get_sample_offers(self, obj):
        payload = []
        for row in _visible_offers(obj)[:8]:
            items = list(row.sub_items.all())
            urls = persist_offer_images(row)
            payload.append({
                'id': str(row.id),
                'title': row.title,
                'image': urls[0] if urls else None,
                'image_urls': urls,
                'availability': row.availability,
                'coverage_zone': row.coverage_zone or row.location,
                'category_name': (
                    row.business.primary_category.name
                    if row.business_id and row.business.primary_category_id else ''
                ),
                'parent_title': row.parent.title if row.parent_id else '',
                'rating': str(row.rating),
                'reviews_count': row.reviews_count,
                'sub_items': [{'id': str(item.id), 'title': item.title} for item in items[:4]],
                'sub_item_count': len(items),
            })
        return payload


class ContactRequestSerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source='service.title', read_only=True, default='')
    provider_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    follow_url = serializers.SerializerMethodField()

    class Meta:
        model = ContactRequest
        fields = [
            'id', 'reference', 'service', 'service_title', 'provider_name',
            'client_name', 'client_email', 'client_phone', 'client_address',
            'preferred_contact', 'message', 'status', 'is_overdue',
            'follow_url', 'created_at',
        ]
        read_only_fields = ('id', 'reference', 'created_at')

    def get_provider_name(self, obj):
        profile = getattr(obj.business, 'service_provider_profile', None)
        if profile:
            return profile.display_name()
        return (obj.business.name or '').strip()

    def get_is_overdue(self, obj):
        if obj.status != 'NEW':
            return False
        return obj.created_at <= timezone.now() - timedelta(hours=24)

    def get_follow_url(self, obj):
        base = (getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173').rstrip('/')
        return f'{base}/services/demandes/{obj.public_token}'


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['id', 'kind', 'body', 'created_at']
        read_only_fields = fields


class ContactRequestDetailSerializer(ContactRequestSerializer):
    messages = serializers.SerializerMethodField()

    class Meta(ContactRequestSerializer.Meta):
        fields = ContactRequestSerializer.Meta.fields + ['messages']

    def get_messages(self, obj):
        include_internal = bool(self.context.get('include_internal'))
        rows = obj.thread.all()
        if not include_internal:
            rows = [item for item in rows if item.kind != 'INTERNAL']
        return ContactMessageSerializer(rows, many=True).data


class PublicContactSerializer(serializers.Serializer):
    client_name = serializers.CharField(max_length=255)
    client_email = serializers.EmailField()
    client_phone = serializers.CharField(max_length=40)
    client_address = serializers.CharField(max_length=255)
    preferred_contact = serializers.ChoiceField(choices=ContactRequest.CONTACT_CHOICES, default='EITHER')
    message = serializers.CharField()
    service_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_client_address(self, value):
        text = (value or '').strip()
        if not text:
            raise serializers.ValidationError('Indiquez votre adresse.')
        return text[:255]

    def validate_client_phone(self, value):
        text = (value or '').strip()
        if not text:
            raise serializers.ValidationError('Indiquez un téléphone.')
        return text[:40]
