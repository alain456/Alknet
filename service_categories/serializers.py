from django.utils.text import slugify
from rest_framework import serializers

from .models import ServiceCategory


def unique_slug(name, exclude_pk=None):
    base = slugify(name) or 'categorie'
    slug = base
    index = 2
    qs = ServiceCategory.objects.all()
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    while qs.filter(slug=slug).exists():
        slug = f'{base}-{index}'
        index += 1
    return slug


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ['id', 'name', 'slug', 'description', 'icon']
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

    def validate_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('Le nom de la catégorie est obligatoire.')
        return name

    def create(self, validated_data):
        if not (validated_data.get('slug') or '').strip():
            validated_data['slug'] = unique_slug(validated_data['name'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'slug' in validated_data and not (validated_data.get('slug') or '').strip():
            validated_data.pop('slug')
        return super().update(instance, validated_data)
