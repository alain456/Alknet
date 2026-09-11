from rest_framework import serializers
from .models import SiteSettings, FooterLink, Partner, ContentPage, ContactMessage


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = "__all__"
        read_only_fields = ("id", "updated_at")

    def validate_password_min_length(self, value):
        if value is None:
            return 8
        value = int(value)
        if value < 4 or value > 128:
            raise serializers.ValidationError(
                "La longueur minimale du mot de passe doit être entre 4 et 128 caractères."
            )
        return value


class FooterLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = FooterLink
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class PartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partner
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ContentPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentPage
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ContentPagePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentPage
        fields = ("slug", "title", "body", "updated_at")


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("name", "email", "phone", "subject", "message")

    def validate_message(self, value):
        text = (value or "").strip()
        if len(text) < 10:
            raise serializers.ValidationError("Le message doit contenir au moins 10 caractères.")
        if len(text) > 5000:
            raise serializers.ValidationError("Le message est trop long (max. 5000 caractères).")
        return text

    def validate_name(self, value):
        name = (value or "").strip()
        if len(name) < 2:
            raise serializers.ValidationError("Veuillez indiquer votre nom.")
        return name

    def validate_subject(self, value):
        subject = (value or "").strip()
        if len(subject) < 3:
            raise serializers.ValidationError("Veuillez indiquer un objet.")
        return subject


class ContactMessageAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = "__all__"
        read_only_fields = (
            "id", "name", "email", "phone", "subject", "message",
            "ip_address", "created_at", "updated_at",
        )
