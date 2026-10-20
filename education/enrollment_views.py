"""API inscriptions et frais — P2/P3 du module Éducation."""
import logging

from django.db.models import Q
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from businesses.subscription import subscription_access_q

from .audit import audit_education
from .enrollment import (
    application_by_access_token, apply_public_candidature, attach_document,
    confirm_fee_stub, decide_application, enrollment_fee_for_campaign,
    public_dossier, receive_complement, start_fee_payment, submit_application,
)
from .models import (
    AdmissionCampaign, EducationFee, EducationFeePayment, EducationProgram,
    EnrollmentApplication, PublicationStatus,
)
from .permissions import education_perm, education_tenant_business, scope_to_education_tenant
from .permission_catalog import ADMISSIONS_MANAGE, FEES_MANAGE
from .serializers_enrollment import (
    AdmissionCampaignSerializer, EducationFeePaymentSerializer, EducationFeeSerializer,
    EnrollmentApplicationSerializer,
)
from .throttling import EducationPublicThrottle
from .views import require_education_tenant

logger = logging.getLogger(__name__)


def _public_programs():
    return EducationProgram.objects.filter(
        is_public=True, is_active=True,
        business__education_profile__publication_status=PublicationStatus.PUBLISHED,
        business__is_active=True,
    ).filter(subscription_access_q('business__subscription__'))


class AdmissionCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = AdmissionCampaignSerializer
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        published_school = Q(
            program__isnull=True,
            is_public=True,
            business__education_profile__publication_status=PublicationStatus.PUBLISHED,
            business__is_active=True,
        )
        public = AdmissionCampaign.objects.filter(
            Q(is_public=True, program__in=_public_programs()) | published_school,
        ).filter(
            subscription_access_q('business__subscription__'),
        ).select_related('program', 'business', 'business__education_profile')
        program = (self.request.query_params.get('program') or '').strip()
        year = (self.request.query_params.get('academic_year') or '').strip()
        business_id = (self.request.query_params.get('business') or '').strip()
        if program:
            public = public.filter(program_id=program)
        if year:
            public = public.filter(academic_year__iexact=year)
        if business_id:
            public = public.filter(business_id=business_id)
        if self.action in ('list', 'retrieve') and not (
            self.request.user.is_authenticated and education_tenant_business(self.request.user)
        ):
            return public
        if self.action in ('list', 'retrieve') and self.request.query_params.get('mine') != '1':
            return public
        business = education_tenant_business(self.request.user)
        if not business or not education_perm(self.request.user, business, ADMISSIONS_MANAGE):
            return public
        staff = scope_to_education_tenant(
            self.request.user,
            AdmissionCampaign.objects.select_related('program', 'business', 'business__education_profile'),
        )
        from .scope import faculty_scope_id
        unit_id = faculty_scope_id(self.request.user, business)
        if unit_id:
            staff = staff.filter(
                Q(program__unit_id=unit_id) | Q(program__unit__parent_id=unit_id),
            )
        if program:
            staff = staff.filter(program_id=program)
        if year:
            staff = staff.filter(academic_year__iexact=year)
        return staff

    def perform_create(self, serializer):
        business = require_education_tenant(self.request.user)
        if not education_perm(self.request.user, business, ADMISSIONS_MANAGE):
            raise PermissionDenied('Droit admissions requis.')
        program = serializer.validated_data.get('program')
        if program is None:
            slug = getattr(getattr(business, 'primary_category', None), 'slug', '')
            if slug != 'ecole':
                raise ValidationError({'program': 'Choisissez une formation.'})
        elif program.business_id != business.id:
            raise ValidationError({'program': 'Formation d’un autre établissement.'})
        campaign = serializer.save(business=business)
        audit_education(
            'EDUCATION_CAMPAIGN_CREATE', campaign.business, f'education.campaign:{campaign.pk}',
            user=self.request.user, request=self.request, academic_year=campaign.academic_year,
        )

    def perform_update(self, serializer):
        business = require_education_tenant(self.request.user)
        if not education_perm(self.request.user, business, ADMISSIONS_MANAGE):
            raise PermissionDenied('Droit admissions requis.')
        if serializer.instance.business_id != business.id:
            raise PermissionDenied('Année d’un autre établissement.')
        serializer.save()
        audit_education(
            'EDUCATION_CAMPAIGN_UPDATE', serializer.instance.business,
            f'education.campaign:{serializer.instance.pk}', user=self.request.user, request=self.request,
        )

    def perform_destroy(self, instance):
        business = require_education_tenant(self.request.user)
        if not education_perm(self.request.user, business, ADMISSIONS_MANAGE):
            raise PermissionDenied('Droit admissions requis.')
        if instance.business_id != business.id:
            raise PermissionDenied('Année d’un autre établissement.')
        audit_education(
            'EDUCATION_CAMPAIGN_DELETE', instance.business, f'education.campaign:{instance.pk}',
            user=self.request.user, request=self.request,
        )
        fees = EducationFee.objects.filter(campaign=instance)
        if not fees.exists() and instance.program_id is None:
            fees = EducationFee.objects.filter(
                business=instance.business,
                program__isnull=True,
                campaign__isnull=True,
                academic_year__iexact=instance.academic_year,
            )
            if instance.fee_mode == 'PAYANT':
                fees = fees.filter(amount_bif__gt=0)
            elif instance.fee_mode == 'GRATUIT':
                fees = fees.filter(amount_bif=0)
        EducationFeePayment.objects.filter(fee__in=fees).delete()
        EducationFeePayment.objects.filter(application__campaign=instance).delete()
        instance.applications.all().delete()
        fees.delete()
        instance.delete()


class EnrollmentApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = EnrollmentApplicationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        if self.action in ('apply', 'preview_dossier', 'pay_application', 'confirm_application_payment'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        related = (
            'campaign', 'campaign__program', 'campaign__business',
            'campaign__business__education_profile', 'applicant',
        )
        if not user.is_authenticated:
            return EnrollmentApplication.objects.none()
        if business := education_tenant_business(user):
            if education_perm(user, business, ADMISSIONS_MANAGE):
                from .scope import faculty_scope_id, restrict_applications
                rows = scope_to_education_tenant(
                    user, EnrollmentApplication.objects.select_related(*related).prefetch_related('files'),
                )
                return restrict_applications(rows, faculty_scope_id(user, business))
        if getattr(user, 'role', '') == 'SUPER_ADMIN':
            return EnrollmentApplication.objects.none()
        return EnrollmentApplication.objects.filter(
            Q(applicant=user) | Q(student_email__iexact=(user.email or '').strip()),
        ).select_related(*related).prefetch_related('files')

    def perform_create(self, serializer):
        raise ValidationError({
            'detail': 'Utilisez le formulaire d’inscription public (/applications/apply/).',
        })

    @action(
        detail=False, methods=['post'], url_path='apply',
        permission_classes=[AllowAny],
        throttle_classes=[EducationPublicThrottle],
    )
    def apply(self, request):
        """Candidature one-shot (comme une prise de RDV) : pièces + envoi + paiement optionnel."""
        campaign_id = (request.data.get('campaign') or '').strip()
        campaign = AdmissionCampaign.objects.select_related(
            'business', 'business__education_profile', 'program',
        ).filter(pk=campaign_id).first()
        if not campaign:
            return Response({'campaign': 'Campagne introuvable.'}, status=400)

        files_by_label = {}
        # doc_label_0 + doc_file_0 …
        index = 0
        while True:
            label = (request.data.get(f'doc_label_{index}') or '').strip()
            uploaded = request.FILES.get(f'doc_file_{index}')
            if not label and not uploaded:
                break
            if label and uploaded:
                files_by_label[label] = uploaded
            index += 1
            if index > 40:
                break

        actor = request.user if request.user.is_authenticated else None
        fee = enrollment_fee_for_campaign(campaign)
        payment_method = (request.data.get('payment_method') or '').strip().upper()
        bordereau = request.FILES.get('bordereau')
        payer_phone = (request.data.get('payer_phone') or '').strip()
        if fee and int(fee.amount_bif or 0) > 0:
            if payment_method not in ('BURUNDIPAY', 'BORDEREAU'):
                return Response({
                    'payment_method': 'Choisissez BurundiPay ou un bordereau PDF.',
                }, status=400)
            if payment_method == 'BURUNDIPAY' and not payer_phone:
                return Response({'payer_phone': 'Indiquez le numéro BurundiPay.'}, status=400)
            if payment_method == 'BORDEREAU':
                from .enrollment import ensure_bordereau_pdf
                try:
                    ensure_bordereau_pdf(bordereau)
                except ValidationError as exc:
                    detail = exc.detail if isinstance(exc.detail, dict) else {'bordereau': 'Le bordereau doit être un PDF.'}
                    return Response(detail, status=400)
        try:
            application = apply_public_candidature(
                campaign=campaign,
                actor=actor,
                data=request.data,
                files_by_label=files_by_label,
            )
        except ValidationError as exc:
            logger.warning('Inscription refusée: %s', exc.detail)
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            if detail.get('suivi_url'):
                existing = EnrollmentApplication.objects.filter(
                    campaign=campaign,
                    student_email__iexact=(request.data.get('student_email') or '').strip(),
                ).first()
                if existing:
                    return Response({
                        'ok': True,
                        'already_exists': True,
                        'message': 'Un dossier existe déjà pour cet e-mail. Vous pouvez le suivre avec le lien ci-dessous.',
                        'application': EnrollmentApplicationSerializer(existing, context={'request': request}).data,
                        'fee': None,
                        'payment': None,
                    }, status=200)
            raise

        payment_payload = None
        pay_result = {'ok': True, 'message': ''}
        if fee and int(fee.amount_bif or 0) > 0 and payment_method == 'BORDEREAU':
            from .enrollment import record_inscription_bordereau
            payment = record_inscription_bordereau(fee, application, bordereau)
            payment_payload = EducationFeePaymentSerializer(payment).data
            pay_result = {'ok': True, 'message': 'Bordereau reçu. Le comptable le verra avec le dossier.'}
        elif fee and int(fee.amount_bif or 0) > 0:
            payment, pay_result = start_fee_payment(
                fee,
                applicant=application.applicant,
                payer_phone=payer_phone,
                application=application,
            )
            payment_payload = EducationFeePaymentSerializer(payment).data

        from config.metrics import incr
        incr('education_applications_created')
        return Response({
            'ok': bool(pay_result.get('ok', True)),
            'message': pay_result.get('message') or (
                'Classe complète. Votre dossier est sur la liste d’attente. L’école vous écrira si une place se libère.'
                if getattr(application, '_class_full', False)
                else (
                    'Dossier reçu. Il est en liste d’attente : l’école va l’accepter ou le refuser.'
                    if application.status == 'LISTE_ATTENTE'
                    else 'Candidature enregistrée. Un e-mail de confirmation vous a été envoyé.'
                )
            ),
            'application': EnrollmentApplicationSerializer(application, context={'request': request}).data,
            'fee': EducationFeeSerializer(fee).data if fee else None,
            'payment': payment_payload,
        }, status=201)

    @action(
        detail=False, methods=['post'], url_path='preview-dossier',
        permission_classes=[AllowAny],
        throttle_classes=[EducationPublicThrottle],
    )
    def preview_dossier(self, request):
        """PDF facultatif avant l’envoi : mêmes champs et mêmes pièces, rien n’est enregistré."""
        from .dossier_pdf import render_preview

        campaign_id = (request.data.get('campaign') or '').strip()
        campaign = AdmissionCampaign.objects.select_related(
            'business', 'business__education_profile', 'program',
        ).filter(pk=campaign_id).first()
        if not campaign:
            return Response({'campaign': 'Campagne introuvable.'}, status=400)
        files_by_label = {}
        index = 0
        while index <= 40:
            label = (request.data.get(f'doc_label_{index}') or '').strip()
            uploaded = request.FILES.get(f'doc_file_{index}')
            if not label and not uploaded:
                break
            if label and uploaded:
                files_by_label[label] = uploaded
            index += 1
        try:
            pdf = render_preview(campaign, request.data, files_by_label)
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="dossier-candidature.pdf"'
        return response

    @action(detail=True, methods=['get'], url_path='dossier')
    def dossier(self, request, pk=None):
        from .dossier_pdf import store_compiled_dossier

        application = self.get_object()
        pdf = b''
        try:
            if application.document:
                application.document.open('rb')
                pdf = application.document.read()
                application.document.close()
        except Exception:
            pdf = b''
        if not pdf.startswith(b'%PDF'):
            try:
                pdf = store_compiled_dossier(application)
            except Exception:
                logger.exception('Dossier PDF admin %s', application.pk)
                return Response({'detail': 'Le dossier PDF est indisponible.'}, status=500)
        safe = ''.join(ch if ch.isalnum() or ch in '-_' else '-' for ch in (application.student_name or 'candidature'))[:40]
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="dossier-{safe}.pdf"'
        return response

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        application = self.get_object()
        submit_application(application, request.user)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=['post'], url_path='document')
    def upload_document(self, request, pk=None):
        application = self.get_object()
        uploaded = request.FILES.get('document') or request.FILES.get('file')
        label = request.data.get('label') or request.POST.get('label') or ''
        if not uploaded:
            return Response({'document': 'Fichier requis.'}, status=400)
        attach_document(application, uploaded, request.user, label=label)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=['post'])
    def decide(self, request, pk=None):
        application = self.get_object()
        business = education_tenant_business(request.user)
        if not business or not education_perm(request.user, business, ADMISSIONS_MANAGE):
            raise PermissionDenied('Droit admissions requis.')
        if application.business_id != business.id:
            raise PermissionDenied('Dossier d’un autre établissement.')
        new_status = (request.data.get('status') or '').strip()
        decide_application(
            application, request.user,
            new_status,
            request.data.get('note') or '',
        )
        audit_education(
            'EDUCATION_APPLICATION_UPDATE', application.business,
            f'education.application:{application.pk}', user=request.user, request=request,
            status=new_status,
        )
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=['post'], url_path='pay', permission_classes=[AllowAny])
    def pay_application(self, request, pk=None):
        from .rls import allow_payment_token
        allow_payment_token(request.data.get('payment_token'))
        application = EnrollmentApplication.objects.select_related('campaign').filter(pk=pk).first()
        if not application:
            return Response({'detail': 'Candidature introuvable.'}, status=404)
        token = (request.data.get('payment_token') or '').strip()
        existing = application.fee_payments.order_by('-id').first()
        if existing and token and existing.payment_token != token:
            return Response({'detail': 'Jeton de paiement invalide.'}, status=403)
        if request.user.is_authenticated and application.applicant_id == request.user.id:
            pass
        elif token and existing and existing.payment_token == token:
            pass
        elif not request.user.is_authenticated and not token:
            return Response({'detail': 'Jeton de paiement requis.'}, status=403)

        fee = enrollment_fee_for_campaign(application.campaign)
        if not fee:
            return Response({'detail': 'Aucun frais d’inscription publié.'}, status=400)
        payment, result = start_fee_payment(
            fee,
            applicant=application.applicant,
            payer_phone=request.data.get('payer_phone') or '',
            application=application,
        )
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message') or '',
            'payment': EducationFeePaymentSerializer(payment).data,
            'application': EnrollmentApplicationSerializer(application, context={'request': request}).data,
        }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='confirm-payment', permission_classes=[AllowAny])
    def confirm_application_payment(self, request, pk=None):
        from .rls import allow_payment_token
        allow_payment_token(request.data.get('payment_token'))
        application = EnrollmentApplication.objects.filter(pk=pk).first()
        if not application:
            return Response({'detail': 'Candidature introuvable.'}, status=404)
        token = (request.data.get('payment_token') or '').strip()
        payment = application.fee_payments.order_by('-id').first()
        if not payment:
            return Response({'detail': 'Paiement introuvable.'}, status=404)
        if request.user.is_authenticated and application.applicant_id == request.user.id:
            pass
        elif token and payment.payment_token == token:
            pass
        else:
            return Response({'detail': 'Jeton de paiement invalide.'}, status=403)
        confirm_fee_stub(payment)
        return Response({
            'ok': True,
            'message': 'Paiement confirmé.',
            'payment': EducationFeePaymentSerializer(payment).data,
            'application': EnrollmentApplicationSerializer(application, context={'request': request}).data,
        })


class EnrollmentTrackView(APIView):
    """Suivi public du dossier via le jeton envoyé par e-mail."""
    permission_classes = [AllowAny]
    throttle_classes = [EducationPublicThrottle]

    def get(self, request):
        application = application_by_access_token(request.query_params.get('token'))
        if not application:
            return Response({'detail': 'Dossier introuvable.'}, status=404)
        return Response(public_dossier(application, request))


class EnrollmentTrackDocumentView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        application = application_by_access_token(request.data.get('token'))
        if not application:
            return Response({'detail': 'Dossier introuvable.'}, status=404)
        uploaded = request.FILES.get('file') or request.FILES.get('document')
        if not uploaded:
            return Response({'document': 'Fichier requis.'}, status=400)
        receive_complement(application, uploaded, request.data.get('label') or '')
        return Response(public_dossier(application, request))


class EnrollmentTrackPayView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        application = application_by_access_token(request.data.get('token'))
        if not application:
            return Response({'detail': 'Dossier introuvable.'}, status=404)
        fee = enrollment_fee_for_campaign(application.campaign)
        if not fee or int(fee.amount_bif or 0) <= 0:
            return Response({'detail': 'Aucun frais à payer.'}, status=400)
        payment, result = start_fee_payment(
            fee,
            applicant=application.applicant,
            payer_phone=request.data.get('payer_phone') or '',
            application=application,
        )
        payload = public_dossier(application, request)
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message') or '',
            'payment_token': payment.payment_token,
            'dossier': payload,
        }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)


class EnrollmentTrackConfirmPayView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        application = application_by_access_token(request.data.get('token'))
        if not application:
            return Response({'detail': 'Dossier introuvable.'}, status=404)
        payment = application.fee_payments.order_by('-id').first()
        if not payment:
            return Response({'detail': 'Paiement introuvable.'}, status=404)
        confirm_fee_stub(payment)
        return Response({
            'ok': True,
            'message': 'Paiement confirmé.',
            'dossier': public_dossier(application, request),
        })


class SchoolFeeLedgerView(APIView):
    """Élèves de l'école et frais d'inscription — réservé au droit frais (comptable)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = education_tenant_business(request.user)
        if not business or not education_perm(request.user, business, FEES_MANAGE):
            return Response({'detail': 'Droit frais requis.'}, status=status.HTTP_403_FORBIDDEN)
        from .school_enrollment_docs import TRACK_ECOFO, TRACK_POST, track_label
        from .school_years import year_label

        applications = (
            EnrollmentApplication.objects.filter(campaign__business=business)
            .select_related('campaign', 'campaign__program')
            .prefetch_related('fee_payments')
            .order_by('student_name', 'created_at')
        )
        students = []
        expected = 0
        collected = 0
        for application in applications:
            fee = enrollment_fee_for_campaign(application.campaign)
            amount = int(fee.amount_bif) if fee else 0
            payments = list(application.fee_payments.all())
            payment = payments[-1] if payments else None
            if amount <= 0:
                pay_status = 'WAIVED'
                fee_mode = 'GRATUIT'
            else:
                pay_status = payment.status if payment else 'UNPAID'
                fee_mode = 'PAYANT'
                expected += amount
                if pay_status == 'PAID':
                    collected += amount
            if application.campaign.program_id:
                classroom = application.campaign.program.title
            elif application.track:
                parts = [track_label(application.track)]
                if application.track == TRACK_ECOFO and application.ecofo_year:
                    parts.append(year_label(application.ecofo_year))
                if application.track == TRACK_POST and application.post_section:
                    parts.append(application.post_section)
                    if application.post_year:
                        parts.append(year_label(application.post_year))
                classroom = ' · '.join(parts)
            else:
                classroom = ''
            accepted = application.status in ('ACCEPTEE', 'CONFIRMEE')
            refused = application.status == 'REFUSEE'
            if fee_mode == 'GRATUIT':
                ledger = 'FREE'
            elif pay_status == 'PAID' and refused:
                ledger = 'PAID_REFUSED'
            elif pay_status == 'PAID' and accepted:
                ledger = 'COLLECTED'
            elif pay_status == 'PAID':
                ledger = 'PAID_PENDING'
            elif pay_status == 'BORDEREAU_RECU':
                ledger = 'BORDEREAU'
            else:
                ledger = 'TO_COLLECT'
            students.append({
                'id': str(application.id),
                'ledger': ledger,
                'student_name': application.student_name,
                'student_email': application.student_email,
                'student_phone': application.student_phone,
                'guardian_name': application.guardian_name,
                'guardian_phone': application.guardian_phone,
                'classroom': classroom,
                'academic_year': application.campaign.academic_year,
                'status': application.status,
                'fee_label': fee.label if fee else ('Inscription gratuite' if fee_mode == 'GRATUIT' else ''),
                'fee_mode': fee_mode,
                'amount_bif': amount,
                'payment_status': pay_status,
                'payment_method': (
                    payment.method if payment and payment.method
                    else ('BURUNDIPAY' if pay_status in ('PAID', 'AWAITING_PIN', 'FAILED') else '')
                ),
                'has_bordereau': bool(payment and payment.bordereau),
                'payer_phone': payment.payer_phone if payment else '',
                'paid_at': payment.paid_at if payment else None,
            })
        from businesses import burundipay
        return Response({
            'school_name': business.name,
            'simulation': burundipay.is_stub_mode(),
            'students': students,
            'totals': {
                'students': len(students),
                'expected_bif': expected,
                'collected_bif': collected,
                'paid_count': sum(1 for row in students if row['payment_status'] == 'PAID'),
                'unpaid_count': sum(1 for row in students if row['payment_status'] == 'UNPAID'),
                'awaiting_count': sum(1 for row in students if row['payment_status'] == 'AWAITING_PIN'),
                'failed_count': sum(1 for row in students if row['payment_status'] == 'FAILED'),
                'free_count': sum(1 for row in students if row['payment_status'] == 'WAIVED'),
                'bordereau_count': sum(1 for row in students if row['payment_status'] == 'BORDEREAU_RECU'),
            },
        })


class InscriptionBordereauView(APIView):
    """PDF du bordereau, pour l’administrateur des candidatures ou le comptable."""

    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        business = education_tenant_business(request.user)
        allowed = business and (
            education_perm(request.user, business, FEES_MANAGE)
            or education_perm(request.user, business, ADMISSIONS_MANAGE)
        )
        if not allowed:
            return Response({'detail': 'Droit frais ou candidatures requis.'}, status=status.HTTP_403_FORBIDDEN)
        application = EnrollmentApplication.objects.filter(pk=application_id, business=business).first()
        payment = application.fee_payments.order_by('-id').first() if application else None
        if not payment or not payment.bordereau:
            return Response({'detail': 'Aucun bordereau pour ce dossier.'}, status=404)
        handle = payment.bordereau.open('rb')
        return FileResponse(handle, content_type='application/pdf', as_attachment=True, filename='bordereau.pdf')


class EducationFeeViewSet(viewsets.ModelViewSet):
    serializer_class = EducationFeeSerializer
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        public = EducationFee.objects.filter(
            is_public=True, business__education_profile__publication_status=PublicationStatus.PUBLISHED,
        ).filter(subscription_access_q('business__subscription__'))
        if self.action in ('list', 'retrieve') and self.request.query_params.get('mine') != '1':
            return public
        business = education_tenant_business(self.request.user)
        if not business or not education_perm(self.request.user, business, FEES_MANAGE):
            return public
        return scope_to_education_tenant(self.request.user, EducationFee.objects.all())

    def perform_create(self, serializer):
        business = require_education_tenant(self.request.user)
        if not education_perm(self.request.user, business, FEES_MANAGE):
            raise PermissionDenied('Droit frais requis.')
        program = serializer.validated_data.get('program')
        if program and program.business_id != business.id:
            raise ValidationError({'program': 'Formation d’un autre établissement.'})
        fee = serializer.save(business=business)
        audit_education(
            'EDUCATION_FEE_CREATE', fee.business, f'education.fee:{fee.pk}',
            user=self.request.user, request=self.request, label=fee.label,
        )

    def perform_update(self, serializer):
        serializer.save()
        audit_education(
            'EDUCATION_FEE_UPDATE', serializer.instance.business,
            f'education.fee:{serializer.instance.pk}', user=self.request.user, request=self.request,
        )

    def perform_destroy(self, instance):
        audit_education(
            'EDUCATION_FEE_DELETE', instance.business, f'education.fee:{instance.pk}',
            user=self.request.user, request=self.request,
        )
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def pay(self, request, pk=None):
        fee = EducationFee.objects.filter(pk=pk, is_public=True).first()
        if not fee:
            return Response({'detail': 'Frais introuvable.'}, status=404)
        payment, result = start_fee_payment(fee, request.user, request.data.get('payer_phone') or '')
        return Response({
            'ok': result.get('ok'),
            'message': result.get('message') or '',
            'payment': EducationFeePaymentSerializer(payment).data,
        }, status=status.HTTP_200_OK if result.get('ok') else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='confirm-payment', permission_classes=[IsAuthenticated])
    def confirm_payment(self, request, pk=None):
        payment = EducationFeePayment.objects.filter(fee_id=pk, applicant=request.user).first()
        if not payment:
            return Response({'detail': 'Paiement introuvable.'}, status=404)
        confirm_fee_stub(payment)
        return Response(EducationFeePaymentSerializer(payment).data)
