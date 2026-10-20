from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .serializers import LabeledItemSerializer

from .models import (
    AdmissionCampaign, EducationFee, EducationFeePayment, EducationProgram,
    EnrollmentApplication, EnrollmentDocument,
)
from .school_enrollment_docs import (
    TRACK_ECOFO, TRACK_POST,
    documents_for_track, merge_optional_documents, normalize_extra_criteria, track_label,
)
from .school_years import (
    enrollment_options_for_campaign,
    open_tracks_from_plan,
    validate_enrollment_plan_against_profile,
)
from .enrollment import IDENTITY_CARD_LABEL, is_university_business


class AdmissionCampaignSerializer(serializers.ModelSerializer):
    program = serializers.PrimaryKeyRelatedField(
        queryset=EducationProgram.objects.all(), required=False, allow_null=True,
    )
    program_title = serializers.SerializerMethodField()
    program_level = serializers.SerializerMethodField()
    open_today = serializers.SerializerMethodField()
    required_documents = LabeledItemSerializer(many=True, required=False)
    open_tracks = serializers.ListField(
        child=serializers.CharField(max_length=32), required=False, allow_empty=True,
    )
    enrollment_plan = serializers.ListField(required=False, allow_empty=True)
    fee_label = serializers.CharField(required=False, allow_blank=True, write_only=True, max_length=200)
    fee_amount_bif = serializers.IntegerField(required=False, allow_null=True, write_only=True, min_value=0)
    fee_mode = serializers.ChoiceField(
        choices=(('PAYANT', 'Payante'), ('GRATUIT', 'Gratuite'), ('', '')),
        required=False, allow_blank=True,
    )
    documents_by_track = serializers.SerializerMethodField()
    post_sections = serializers.SerializerMethodField()
    enrollment_options = serializers.SerializerMethodField()
    enrollment_fee = serializers.SerializerMethodField()
    seat_summary = serializers.SerializerMethodField()
    study_years = serializers.SerializerMethodField()
    program_options = serializers.SerializerMethodField()
    identity_document_label = serializers.SerializerMethodField()
    establishment_id = serializers.SerializerMethodField()

    class Meta:
        model = AdmissionCampaign
        fields = [
            'id', 'business', 'program', 'program_title', 'program_level', 'academic_year',
            'opens_on', 'closes_on', 'late_opens_on', 'late_closes_on',
            'contest_date', 'contest_name', 'results_date', 'confirmation_start', 'confirmation_end',
            'required_diploma', 'prerequisites', 'min_grade', 'extra_conditions',
            'regulatory_requirements', 'required_documents', 'open_tracks', 'enrollment_plan',
            'extra_criteria',
            'documents_by_track', 'post_sections', 'enrollment_options', 'enrollment_fee',
            'seat_summary', 'study_years', 'program_options', 'identity_document_label',
            'establishment_id',
            'fee_label', 'fee_amount_bif', 'fee_mode', 'is_public', 'open_today',
            'year_start', 'year_break_start', 'year_break_end', 'year_exam_start', 'year_deliberation',
        ]
        read_only_fields = ['business']
        validators = []

    def validate(self, attrs):
        program = attrs.get('program', getattr(self.instance, 'program', None))
        year = attrs.get('academic_year', getattr(self.instance, 'academic_year', ''))
        request = self.context.get('request')
        business = None
        if self.instance is not None:
            business = self.instance.business
        elif request and getattr(request, 'user', None):
            from .permissions import education_tenant_business
            business = education_tenant_business(request.user)

        is_university = program is not None and is_university_business(business)
        if program and year and not is_university:
            taken = AdmissionCampaign.objects.filter(program=program, academic_year=year)
            if self.instance is not None:
                taken = taken.exclude(pk=self.instance.pk)
            if taken.exists():
                raise serializers.ValidationError({
                    'academic_year': 'Une campagne existe déjà pour cette formation et cette année.',
                })

        is_school = program is None and (
            (business and getattr(getattr(business, 'primary_category', None), 'slug', '') == 'ecole')
            or (self.instance is not None and self.instance.program_id is None)
        )
        if is_school and business:
            profile = getattr(business, 'education_profile', None)
            plan_raw = attrs.get('enrollment_plan')
            if plan_raw is None and self.instance is not None:
                plan_raw = self.instance.enrollment_plan or []
            if plan_raw is None:
                plan_raw = []

            # Compat : ancienne API avec open_tracks seuls → plan minimal sans places.
            if not plan_raw and attrs.get('open_tracks'):
                raise serializers.ValidationError({
                    'enrollment_plan': (
                        'Indiquez les années ouvertes et le nombre de places pour chaque parcours.'
                    ),
                })

            try:
                plan = validate_enrollment_plan_against_profile(plan_raw, profile)
            except DjangoValidationError as exc:
                if getattr(exc, 'message_dict', None):
                    raise serializers.ValidationError(exc.message_dict) from exc
                raise serializers.ValidationError({
                    'enrollment_plan': list(getattr(exc, 'messages', [str(exc)])),
                }) from exc

            attrs['enrollment_plan'] = plan
            attrs['open_tracks'] = open_tracks_from_plan(plan)

            self._choose_fee(
                attrs, year,
                AdmissionCampaign.objects.filter(business=business, program__isnull=True),
                (
                    'Une inscription {label} est déjà ouverte pour {year}. '
                    'L’inscription {other} peut rester ouverte en même temps.'
                ),
            )
        elif program is not None:
            attrs['open_tracks'] = []
            attrs['enrollment_plan'] = []
            if is_university_business(business):
                self._choose_fee(
                    attrs, year,
                    AdmissionCampaign.objects.filter(program=program),
                    (
                        'Une inscription {label} est déjà ouverte pour ce programme en {year}. '
                        'L’inscription {other} peut rester ouverte en même temps.'
                    ),
                )
        if 'extra_criteria' in attrs:
            attrs['extra_criteria'] = normalize_extra_criteria(attrs.get('extra_criteria'))
        return attrs

    def _choose_fee(self, attrs, year, taken, message):
        fee_mode = (attrs.get('fee_mode') or '').strip().upper()
        fee_amount = attrs.get('fee_amount_bif', serializers.empty)
        touches_fee = (
            self.instance is None
            or 'fee_mode' in attrs
            or fee_amount is not serializers.empty
        )
        if not touches_fee:
            return
        if not fee_mode:
            if fee_amount is serializers.empty or fee_amount is None:
                if self.instance is None:
                    raise serializers.ValidationError({
                        'fee_mode': 'Indiquez si l’inscription est payante ou gratuite.',
                    })
            else:
                fee_mode = 'PAYANT' if int(fee_amount) > 0 else 'GRATUIT'
        if fee_mode and fee_mode not in ('PAYANT', 'GRATUIT'):
            raise serializers.ValidationError({
                'fee_mode': 'Choisissez une inscription payante ou gratuite.',
            })
        if fee_mode == 'GRATUIT':
            attrs['fee_mode'] = 'GRATUIT'
            attrs['fee_amount_bif'] = 0
        elif fee_mode == 'PAYANT':
            amount = 0 if fee_amount is serializers.empty or fee_amount is None else int(fee_amount)
            if amount <= 0:
                raise serializers.ValidationError({
                    'fee_amount_bif': 'Une inscription payante exige un montant supérieur à 0.',
                })
            attrs['fee_mode'] = 'PAYANT'
            attrs['fee_amount_bif'] = amount
        mode = attrs.get('fee_mode') or getattr(self.instance, 'fee_mode', '')
        if mode and year:
            clash = taken.filter(academic_year__iexact=year, fee_mode=mode)
            if self.instance is not None:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                label = 'payante' if mode == 'PAYANT' else 'gratuite'
                other = 'gratuite' if mode == 'PAYANT' else 'payante'
                raise serializers.ValidationError({
                    'fee_mode': message.format(label=label, other=other, year=year),
                })

    def create(self, validated_data):
        fee_amount = validated_data.pop('fee_amount_bif', None)
        fee_label = (validated_data.pop('fee_label', None) or '').strip() or 'Frais d’inscription'
        campaign = super().create(validated_data)
        if fee_amount is not None:
            self._upsert_campaign_fee(campaign, fee_label, int(fee_amount))
        return campaign

    def update(self, instance, validated_data):
        fee_amount = validated_data.pop('fee_amount_bif', None)
        fee_label = (validated_data.pop('fee_label', None) or '').strip() or 'Frais d’inscription'
        previous_year = instance.academic_year
        campaign = super().update(instance, validated_data)
        if fee_amount is not None:
            self._upsert_campaign_fee(campaign, fee_label, int(fee_amount), previous_year=previous_year)
        return campaign

    def _upsert_campaign_fee(self, campaign, label, amount_bif, previous_year=None):
        existing = EducationFee.objects.filter(campaign=campaign).first()
        if existing is None:
            loose = EducationFee.objects.filter(
                business=campaign.business,
                campaign__isnull=True,
                academic_year__iexact=previous_year or campaign.academic_year,
            )
            if campaign.program_id:
                loose = loose.filter(program_id=campaign.program_id)
            else:
                loose = loose.filter(program__isnull=True)
            if campaign.fee_mode == 'PAYANT':
                loose = loose.filter(amount_bif__gt=0)
            elif campaign.fee_mode == 'GRATUIT':
                loose = loose.filter(amount_bif=0)
            existing = loose.first()
        if existing:
            existing.label = label[:200]
            existing.amount_bif = amount_bif
            existing.academic_year = campaign.academic_year
            existing.program = campaign.program
            existing.campaign = campaign
            existing.is_public = True
            existing.is_required = True
            existing.save(update_fields=[
                'label', 'amount_bif', 'academic_year', 'program', 'campaign', 'is_public', 'is_required',
            ])
            return existing
        return EducationFee.objects.create(
            business=campaign.business,
            program=campaign.program,
            campaign=campaign,
            academic_year=campaign.academic_year,
            label=label[:200],
            amount_bif=amount_bif,
            is_public=True,
            is_required=True,
        )

    def get_program_title(self, obj):
        if obj.program_id:
            return obj.program.title
        title = f'Année scolaire {obj.academic_year}'
        if obj.fee_mode == 'PAYANT':
            return f'{title} · Inscription payante'
        if obj.fee_mode == 'GRATUIT':
            return f'{title} · Inscription gratuite'
        return title

    def get_program_level(self, obj):
        return obj.program.level if obj.program_id else ''

    def get_study_years(self, obj):
        if not obj.program_id:
            return []
        from .enrollment import university_study_years
        return university_study_years(obj.program)

    def get_program_options(self, obj):
        if not obj.program_id:
            return []
        return [str(item).strip() for item in (obj.program.options or []) if str(item).strip()]

    def get_establishment_id(self, obj):
        try:
            return str(obj.business.education_profile.id)
        except Exception:
            return ''

    def get_identity_document_label(self, obj):
        if not obj.program_id:
            return ''
        return IDENTITY_CARD_LABEL

    def get_seat_summary(self, obj):
        if obj.program_id:
            return []
        from .school_years import seat_summary_for_campaign
        return seat_summary_for_campaign(obj)

    def get_open_today(self, obj):
        from django.utils import timezone
        return obj.is_open_on(timezone.localdate())

    def get_documents_by_track(self, obj):
        if obj.program_id:
            return {}
        from .school_enrollment_docs import resolved_school_documents
        profile = getattr(obj.business, 'education_profile', None)
        options = enrollment_options_for_campaign(obj, profile)
        preview = {}
        for track in (obj.open_tracks or []):
            if track == TRACK_ECOFO:
                preview[track] = {
                    'label': track_label(track),
                    'years': [
                        {
                            'value': row['value'],
                            'label': row['label'],
                            'seats': row.get('seats'),
                            'documents': resolved_school_documents(obj, TRACK_ECOFO, row['value']),
                        }
                        for row in options['ecofo_years']
                    ],
                }
            elif track == TRACK_POST:
                sections = []
                for section in options['post_sections']:
                    years = []
                    for row in section.get('years') or []:
                        years.append({
                            **row,
                            'documents': resolved_school_documents(
                                obj, TRACK_POST, row['value'], section.get('name') or '',
                            ),
                        })
                    sections.append({**section, 'years': years})
                preview[track] = {
                    'label': track_label(track),
                    'documents': resolved_school_documents(obj, TRACK_POST),
                    'sections': sections,
                }
            else:
                preview[track] = {
                    'label': track_label(track),
                    'seats': options.get('prescolaire_seats'),
                    'documents': resolved_school_documents(obj, track),
                }
        return preview

    def get_post_sections(self, obj):
        if obj.program_id:
            return []
        profile = getattr(obj.business, 'education_profile', None)
        return enrollment_options_for_campaign(obj, profile)['post_sections']

    def get_enrollment_options(self, obj):
        if obj.program_id:
            return {'ecofo_years': [], 'post_sections': [], 'prescolaire_seats': None}
        profile = getattr(obj.business, 'education_profile', None)
        return enrollment_options_for_campaign(obj, profile)

    def get_enrollment_fee(self, obj):
        from .enrollment import enrollment_fee_for_campaign
        fee = enrollment_fee_for_campaign(obj)
        if not fee:
            return None
        return {
            'id': str(fee.id),
            'label': fee.label,
            'amount_bif': fee.amount_bif,
            'academic_year': fee.academic_year,
            'fee_mode': 'PAYANT' if int(fee.amount_bif or 0) > 0 else 'GRATUIT',
        }


class EnrollmentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnrollmentDocument
        fields = ['id', 'label', 'file', 'uploaded_at']
        read_only_fields = fields


class EnrollmentApplicationSerializer(serializers.ModelSerializer):
    program_title = serializers.SerializerMethodField()
    academic_year = serializers.CharField(source='campaign.academic_year', read_only=True)
    applicant_email = serializers.SerializerMethodField()
    required_documents = serializers.SerializerMethodField()
    files = EnrollmentDocumentSerializer(many=True, read_only=True)
    track_label = serializers.SerializerMethodField()
    open_tracks = serializers.SerializerMethodField()
    post_sections = serializers.SerializerMethodField()
    suivi_url = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    next_class = serializers.SerializerMethodField()

    class Meta:
        model = EnrollmentApplication
        fields = [
            'id', 'business', 'campaign', 'program_title', 'academic_year',
            'applicant', 'applicant_email', 'student_name', 'student_email', 'student_phone',
            'birth_date', 'gender', 'previous_school', 'student_address',
            'guardian_name', 'guardian_phone', 'guardian_link',
            'status', 'decision_note', 'document',
            'track', 'track_label', 'ecofo_year', 'post_section', 'post_year', 'next_class',
            'required_documents', 'profile_details', 'criteria_acknowledged', 'files', 'open_tracks', 'post_sections',
            'suivi_url', 'payment_status', 'payment_method',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'business', 'applicant', 'status', 'decision_note', 'document',
            'required_documents', 'criteria_acknowledged', 'profile_details', 'student_name', 'student_email', 'student_phone',
            'birth_date', 'gender', 'previous_school', 'student_address',
            'guardian_name', 'guardian_phone', 'guardian_link',
        ]

    def get_suivi_url(self, obj):
        from .enrollment import dossier_url
        if not obj.access_token:
            return ''
        return dossier_url(obj)

    def get_next_class(self, obj):
        from .school_years import year_label
        if obj.status not in ('ACCEPTEE', 'CONFIRMEE'):
            return ''
        if obj.track == TRACK_ECOFO and str(obj.ecofo_year).isdigit():
            nxt = int(obj.ecofo_year) + 1
            if nxt <= 9:
                return f'ECOFO · {year_label(str(nxt))}'
        if obj.track == TRACK_POST and str(obj.post_year).isdigit():
            nxt = int(obj.post_year) + 1
            if nxt <= 4:
                return f'{obj.post_section} · {year_label(str(nxt))}'
        return ''

    def get_payment_status(self, obj):
        from .enrollment import enrollment_fee_for_campaign
        fee = enrollment_fee_for_campaign(obj.campaign)
        if not fee or int(fee.amount_bif or 0) <= 0:
            return 'WAIVED'
        payment = obj.fee_payments.order_by('-id').first()
        return payment.status if payment else 'UNPAID'

    def get_payment_method(self, obj):
        payment = obj.fee_payments.order_by('-id').first()
        if not payment:
            return ''
        if payment.method:
            return payment.method
        if payment.status in ('PAID', 'AWAITING_PIN', 'FAILED'):
            return 'BURUNDIPAY'
        return ''

    def get_applicant_email(self, obj):
        return (obj.student_email or '').strip() or (
            obj.applicant.email if obj.applicant_id else ''
        )

    def get_required_documents(self, obj):
        if obj.required_documents:
            return obj.required_documents
        return obj.campaign.required_documents or []

    def get_track_label(self, obj):
        return track_label(obj.track)

    def get_open_tracks(self, obj):
        return obj.campaign.open_tracks or []

    def get_post_sections(self, obj):
        profile = getattr(obj.campaign.business, 'education_profile', None)
        return enrollment_options_for_campaign(obj.campaign, profile)['post_sections']

    def get_program_title(self, obj):
        from .school_years import year_label
        campaign = obj.campaign
        if campaign.program_id:
            return campaign.program.title
        if obj.track:
            parts = [track_label(obj.track)]
            if obj.track == TRACK_ECOFO and obj.ecofo_year:
                parts.append(year_label(obj.ecofo_year))
            if obj.track == TRACK_POST and obj.post_section:
                parts.append(obj.post_section)
                if obj.post_year:
                    parts.append(year_label(obj.post_year))
            return f"{' · '.join(parts)} — {campaign.academic_year}"
        return f'Année scolaire {campaign.academic_year}'

    def validate(self, attrs):
        campaign = attrs.get('campaign') or getattr(self.instance, 'campaign', None)
        if campaign is None:
            return attrs
        from .enrollment import resolve_school_track_fields
        profile = getattr(campaign.business, 'education_profile', None)
        track, ecofo_year, post_section, post_year, docs = resolve_school_track_fields(
            campaign,
            attrs.get('track', getattr(self.instance, 'track', '')),
            attrs.get('ecofo_year', getattr(self.instance, 'ecofo_year', '')),
            attrs.get('post_section', getattr(self.instance, 'post_section', '')),
            attrs.get('post_year', getattr(self.instance, 'post_year', '')),
            profile,
        )
        attrs['track'] = track
        attrs['ecofo_year'] = ecofo_year
        attrs['post_section'] = post_section
        attrs['post_year'] = post_year
        attrs['_computed_documents'] = docs
        return attrs

    def create(self, validated_data):
        docs = validated_data.pop('_computed_documents', None)
        campaign = validated_data['campaign']
        extras = campaign.required_documents or []
        if docs is not None:
            validated_data['required_documents'] = docs
        elif campaign.program_id is None:
            validated_data['required_documents'] = merge_optional_documents(
                documents_for_track(
                    validated_data.get('track', ''),
                    validated_data.get('ecofo_year', ''),
                    validated_data.get('post_year', ''),
                ),
                extras,
            )
        else:
            validated_data['required_documents'] = list(extras)
        return super().create(validated_data)


class EducationFeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EducationFee
        fields = [
            'id', 'business', 'program', 'academic_year', 'label', 'amount_bif',
            'is_required', 'due_date', 'is_public',
        ]
        read_only_fields = ['business']


class EducationFeePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EducationFeePayment
        fields = [
            'id', 'fee', 'application', 'status', 'method', 'payer_phone', 'provider_reference',
            'merchant_account', 'payment_token', 'paid_at',
        ]
        read_only_fields = fields
