from rest_framework import serializers
from .models import Province, Commune, Zone, Quartier, Avenue

class AvenueSerializer(serializers.ModelSerializer):
    quartier_name = serializers.CharField(source='quartier.name', read_only=True)

    class Meta:
        model = Avenue
        fields = '__all__'
        validators = []

    def validate(self, attrs):
        quartier = attrs.get('quartier', getattr(self.instance, 'quartier', None))
        name = attrs.get('name', getattr(self.instance, 'name', None))
        if quartier and name:
            qs = Avenue.objects.filter(quartier=quartier, name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "Une avenue portant ce nom existe déjà dans ce quartier."})
        return attrs

class QuartierSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    commune_name = serializers.CharField(source='zone.commune.name', read_only=True)
    province_name = serializers.CharField(source='zone.commune.province.name', read_only=True)
    avenues = AvenueSerializer(many=True, read_only=True)

    class Meta:
        model = Quartier
        fields = '__all__'
        validators = []

    def validate(self, attrs):
        zone = attrs.get('zone', getattr(self.instance, 'zone', None))
        name = attrs.get('name', getattr(self.instance, 'name', None))
        if zone and name:
            qs = Quartier.objects.filter(zone=zone, name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "Un quartier portant ce nom existe déjà dans cette zone."})
        return attrs

class ZoneSerializer(serializers.ModelSerializer):
    commune_name = serializers.CharField(source='commune.name', read_only=True)
    province_name = serializers.CharField(source='commune.province.name', read_only=True)
    quartiers = QuartierSerializer(many=True, read_only=True)

    class Meta:
        model = Zone
        fields = '__all__'
        validators = []

    def validate(self, attrs):
        commune = attrs.get('commune', getattr(self.instance, 'commune', None))
        name = attrs.get('name', getattr(self.instance, 'name', None))
        if commune and name:
            qs = Zone.objects.filter(commune=commune, name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "Une zone portant ce nom existe déjà dans cette commune."})
        return attrs

class CommuneSerializer(serializers.ModelSerializer):
    province_name = serializers.CharField(source='province.name', read_only=True)
    zones = ZoneSerializer(many=True, read_only=True)

    class Meta:
        model = Commune
        fields = '__all__'
        validators = []

    def validate(self, attrs):
        province = attrs.get('province', getattr(self.instance, 'province', None))
        name = attrs.get('name', getattr(self.instance, 'name', None))
        if province and name:
            qs = Commune.objects.filter(province=province, name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "Une commune portant ce nom existe déjà dans cette province."})
        return attrs

class ProvinceSerializer(serializers.ModelSerializer):
    communes = CommuneSerializer(many=True, read_only=True)

    class Meta:
        model = Province
        fields = '__all__'
        validators = []

    def validate(self, attrs):
        name = attrs.get('name', getattr(self.instance, 'name', None))
        if name:
            qs = Province.objects.filter(name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "Une province portant ce nom existe déjà."})
        return attrs
