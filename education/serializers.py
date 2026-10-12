from rest_framework import serializers

from businesses.models import Business

from .geo import reference_areas
from .models import EducationProfile, EducationProgram, EducationUnit


class ClassItemSerializer(serializers.Serializer):
    value = serializers.CharField(max_length=32)
    label = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate(self, attrs):
        value = (attrs.get('value') or '').strip()
        label = (attrs.get('label') or '').strip()
        if not value:
            raise serializers.ValidationError({'value': 'Indiquez le code de la classe.'})
        attrs['value'] = value
        attrs['label'] = label or value
        return attrs


class PostSectionSerializer(serializers.Serializer):
    orientation = serializers.ChoiceField(choices=EducationProfile.POST_ORIENTATION_CHOICES)
    name = serializers.CharField(max_length=120)
    # CRUD dynamique : [{value, label}] — `years` conservé pour compat (nombres ou objets).
    classes = ClassItemSerializer(many=True, required=False)
    years = serializers.ListField(required=False, allow_empty=True)

    def validate(self, attrs):
        from .school_years import normalize_class_list, DEFAULT_POST_YEARS
        classes = attrs.get('classes')
        years = attrs.get('years')
        normalized = normalize_class_list(classes or years, DEFAULT_POST_YEARS)
        if not normalized:
            raise serializers.ValidationError({
                'classes': 'Ajoutez au moins une classe pour cette section.',
            })
        attrs['classes'] = normalized
        attrs['years'] = [row['value'] for row in normalized]
        return attrs

    def create(self, validated_data):
        return validated_data

    def update(self, instance, validated_data):
        return instance


class EducationPublicBusinessSerializer(serializers.ModelSerializer):
    """Identité publique de l'établissement.

    Volontairement pas `BusinessSerializer` : il est en `fields = '__all__'` et
    exposerait publiquement le compte de paiement BurundiPay, le propriétaire et
    les attributs internes. Ici la liste est fermée, champ par champ.
    """

    category_name = serializers.CharField(source='primary_category.name', read_only=True, default='')
    category_slug = serializers.CharField(source='primary_category.slug', read_only=True, default='')
    full_address = serializers.ReadOnlyField()

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'description', 'logo', 'phone', 'email', 'website',
            'address', 'province', 'commune', 'zone', 'quartier', 'avenue',
            'latitude', 'longitude',
            'is_verified', 'verification_status',
            'category_name', 'category_slug', 'full_address',
        ]


class LabeledItemSerializer(serializers.Serializer):
    """Élément de liste JSON : {label, description}.

    Valider la forme ici plutôt que dans le modèle : une liste libre en base
    ferait planter la page publique au premier `s['label']` sur une entrée
    malformée.
    """

    label = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    description = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')

    def create(self, validated_data):
        return validated_data

    def update(self, instance, validated_data):
        return instance


class EducationUnitSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True, default='')
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = EducationUnit
        fields = [
            'id', 'name', 'kind', 'kind_label', 'code', 'description',
            'is_active', 'parent', 'parent_name',
        ]


class EducationProgramSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source='unit.name', read_only=True, default='')
    faculty_name = serializers.SerializerMethodField()
    level_label = serializers.CharField(source='get_level_display', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    business_province = serializers.CharField(source='business.province', read_only=True, default='')
    business_commune = serializers.CharField(source='business.commune', read_only=True, default='')
    required_documents = LabeledItemSerializer(many=True, required=False)
    fees = serializers.SerializerMethodField()
    campaigns = serializers.SerializerMethodField()

    class Meta:
        model = EducationProgram
        fields = [
            'id', 'business', 'business_name', 'business_province', 'business_commune',
            'unit', 'unit_name', 'faculty_name', 'title', 'domain', 'degree_awarded',
            'duration_years', 'duration_label', 'entry_level', 'exit_level',
            'career_outlook', 'level', 'level_label', 'is_active', 'is_public', 'display_order',
            'semester_organization', 'main_subjects', 'admission_conditions',
            'required_documents', 'internship_details', 'fees', 'campaigns',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_faculty_name(self, obj):
        unit = obj.unit
        if not unit:
            return ''
        parent = getattr(unit, 'parent', None)
        if parent:
            return parent.name
        if unit.kind in ('FACULTY', 'SCHOOL'):
            return unit.name
        return ''

    def get_fees(self, obj):
        rows = obj.fees.all() if hasattr(obj, 'fees') else []
        return [
            {
                'id': str(fee.id),
                'label': fee.label,
                'amount_bif': fee.amount_bif,
                'academic_year': fee.academic_year,
                'is_required': fee.is_required,
            }
            for fee in rows
            if fee.is_public
        ]

    def get_campaigns(self, obj):
        from .serializers_enrollment import AdmissionCampaignSerializer
        rows = obj.campaigns.filter(is_public=True).order_by('-academic_year', '-opens_on')
        return AdmissionCampaignSerializer(rows, many=True).data


class EducationProgramWriteSerializer(EducationProgramSerializer):
    """L'établissement ne choisit pas son établissement : c'est le tenant."""

    class Meta(EducationProgramSerializer.Meta):
        read_only_fields = ['created_at', 'updated_at', 'business']


class EducationProfileSerializer(serializers.ModelSerializer):
    business_detail = EducationPublicBusinessSerializer(source='business', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    establishment_type_label = serializers.CharField(
        source='get_establishment_type_display', read_only=True, default='',
    )
    programs = EducationProgramSerializer(source='education_programs', many=True, read_only=True)

    student_services = LabeledItemSerializer(many=True, required=False)
    post_fondamental_sections = PostSectionSerializer(many=True, required=False)
    operational_status_label = serializers.CharField(
        source='get_operational_status_display', read_only=True,
    )
    boarding_regime_label = serializers.CharField(
        source='get_boarding_regime_display', read_only=True, default='',
    )
    nearby_areas = serializers.SerializerMethodField()

    class Meta:
        model = EducationProfile
        fields = [
            'id', 'business', 'business_detail', 'business_name',
            'operational_status', 'operational_status_label',
            'establishment_type', 'establishment_type_label',
            'nearby_areas',
            'publication_status', 'published_at', 'submitted_at', 'moderation_note',
            'history', 'teaching_languages', 'website', 'institutional_email',
            'short_description', 'official_name', 'description', 'gallery',
            'student_services', 'academic_calendar', 'nearby_landmarks',
            'year_start', 'year_break_start', 'year_break_end', 'year_exam_start', 'year_deliberation',
            'library_hours', 'library_access', 'library_contact',
            'internship_required', 'internship_duration', 'internship_period', 'internship_contact',
            'has_scholarships', 'has_boarding', 'boarding_regime', 'boarding_regime_label', 'has_campus',
            'has_evening_courses', 'has_distance_learning',
            'offers_prescolaire', 'offers_ecofo', 'offers_post_fondamental', 'ecofo_cycles',
            'ecofo_classes', 'post_fondamental_sections',
            'accreditation_number', 'accreditation_body', 'accreditation_valid_until',
            'programs', 'created_at', 'updated_at',
        ]
        # `moderation_note` est le motif de rejet écrit par la modération
        # entreprises : l'établissement le lit mais ne l'écrit jamais.
        read_only_fields = [
            'business', 'publication_status', 'published_at', 'submitted_at',
            'moderation_note', 'created_at', 'updated_at',
        ]

    def get_nearby_areas(self, obj):
        return reference_areas(obj.business)

    def validate_ecofo_cycles(self, value):
        allowed = {code for code, _label in EducationProfile.ECOFO_CYCLE_CHOICES}
        unknown = [code for code in value if code not in allowed]
        if unknown:
            raise serializers.ValidationError('Cycle inconnu.')
        return list(dict.fromkeys(value))

    def validate_ecofo_classes(self, value):
        from .school_years import normalize_class_list
        return normalize_class_list(value or [])


class EducationProfileWriteSerializer(EducationProfileSerializer):
    DATE_FIELDS = (
        'accreditation_valid_until',
        'year_start', 'year_break_start', 'year_break_end',
        'year_exam_start', 'year_deliberation',
    )

    class Meta(EducationProfileSerializer.Meta):
        # `moderation_note` est le motif de rejet écrit par la modération
        # entreprises : l'établissement le lit mais ne l'écrit jamais.
        read_only_fields = [
            'business', 'publication_status', 'published_at', 'submitted_at',
            'moderation_note', 'created_at', 'updated_at',
        ]

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)
        for field in self.DATE_FIELDS:
            if data.get(field) == '':
                data[field] = None
        return super().to_internal_value(data)

    def validate(self, attrs):
        regime = attrs.get('boarding_regime', getattr(self.instance, 'boarding_regime', ''))
        if 'boarding_regime' in attrs:
            attrs['has_boarding'] = bool(regime) and regime != 'EXTERNE'
        return attrs


class EducationProfileListSerializer(serializers.ModelSerializer):
    """Version allégée pour la liste publique."""

    business_name = serializers.CharField(source='business.name', read_only=True)
    business_logo = serializers.CharField(source='business.logo', read_only=True, default='')
    business_province = serializers.CharField(source='business.province', read_only=True, default='')
    business_commune = serializers.CharField(source='business.commune', read_only=True, default='')
    business_zone = serializers.CharField(source='business.zone', read_only=True, default='')
    business_quartier = serializers.CharField(source='business.quartier', read_only=True, default='')
    latitude = serializers.FloatField(source='business.latitude', read_only=True, allow_null=True)
    longitude = serializers.FloatField(source='business.longitude', read_only=True, allow_null=True)
    category_name = serializers.CharField(
        source='business.primary_category.name', read_only=True, default='',
    )
    category_slug = serializers.CharField(
        source='business.primary_category.slug', read_only=True, default='',
    )
    establishment_type_label = serializers.CharField(
        source='get_establishment_type_display', read_only=True, default='',
    )
    boarding_regime_label = serializers.CharField(
        source='get_boarding_regime_display', read_only=True, default='',
    )

    class Meta:
        model = EducationProfile
        fields = [
            'id', 'business', 'business_name', 'business_logo',
            'business_province', 'business_commune', 'business_zone', 'business_quartier',
            'latitude', 'longitude',
            'category_name', 'category_slug', 'establishment_type',
            'establishment_type_label', 'operational_status', 'short_description',
            'has_scholarships', 'has_boarding', 'boarding_regime', 'boarding_regime_label', 'has_campus',
            'has_evening_courses', 'has_distance_learning',
            'offers_prescolaire', 'offers_ecofo', 'offers_post_fondamental',
            'published_at',
        ]
