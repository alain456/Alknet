"""Demandes d'inscription et paiement des frais."""
import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.outbound_mail import send_isoko_mail
from businesses import burundipay
from businesses.payment_access import issue_payment_token
from config.uploads import validate_binary_upload

from .models import (
    AdmissionCampaign, EducationFee, EducationFeePayment, EnrollmentApplication,
    EnrollmentDocument, EnrollmentEvent, PublicationStatus,
)
from .school_enrollment_docs import (
    TRACK_ECOFO, TRACK_POST,
    application_document_labels, documents_for_track, merge_optional_documents,
    normalize_extra_criteria, offered_tracks, track_label,
)
from .school_years import (
    enrollment_options_for_campaign,
    open_tracks_from_plan,
    slot_is_full,
)

logger = logging.getLogger(__name__)

STAFF_NEXT = {
    'ENVOYEE': {'EN_INSTRUCTION', 'COMPLEMENT_DEMANDE', 'ACCEPTEE', 'REFUSEE'},
    'EN_INSTRUCTION': {'COMPLEMENT_DEMANDE', 'ACCEPTEE', 'REFUSEE'},
    'COMPLEMENT_DEMANDE': {'EN_INSTRUCTION', 'ACCEPTEE', 'REFUSEE'},
    'LISTE_ATTENTE': {'ACCEPTEE', 'REFUSEE'},
    'ACCEPTEE': {'CONFIRMEE', 'REFUSEE'},
}

DECISION_MAIL = {
    'ACCEPTEE': (
        'Inscription acceptée',
        'Bonne nouvelle : votre candidature d’inscription a été acceptée.',
    ),
    'REFUSEE': (
        'Inscription refusée',
        'Votre candidature d’inscription a été refusée.',
    ),
    'CONFIRMEE': (
        'Inscription confirmée',
        'Votre inscription est confirmée.',
    ),
    'COMPLEMENT_DEMANDE': (
        'Complément demandé',
        'L’établissement demande un complément pour votre dossier d’inscription.',
    ),
    'EN_INSTRUCTION': (
        'Dossier en instruction',
        'Votre candidature est en cours d’instruction.',
    ),
    'LISTE_ATTENTE': (
        'Liste d’attente',
        'La classe est complète. Votre dossier est sur la liste d’attente.',
    ),
}


def education_merchant_account(business):
    """Compte marchand BurundiPay qui encaisse les frais de l'établissement."""
    if not business:
        return 'EDUCATION_MERCHANT'
    configured = (
        getattr(business, 'lumicash_merchant_account', None)
        or getattr(business, 'burundipay_merchant_account', None) or ''
    ).strip()
    if configured:
        return configured
    return f'EDU-{str(business.id).replace("-", "")[:10].upper()}'


def campaign_open(campaign, day=None):
    day = day or timezone.localdate()
    return campaign.is_open_on(day)


_ROMAN = ('I', 'II', 'III', 'IV', 'V', 'VI')
IDENTITY_CARD_LABEL = 'Carte d’identité'
PASSPORT_PHOTO_LABEL = 'Photo passeport'
_PHOTO_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')


def is_passport_photo(label):
    return (label or '').strip().casefold() == PASSPORT_PHOTO_LABEL.casefold()


def with_standard_pieces(docs, *, university=False):
    """Photo passeport obligatoire. À l'université, la carte d'identité l'est aussi."""
    rows = []
    for item in docs or []:
        if isinstance(item, dict):
            rows.append(dict(item))
        elif str(item).strip():
            rows.append({'label': str(item).strip(), 'description': '', 'required': True})
    labels = {(row.get('label') or '').strip().casefold() for row in rows}
    if PASSPORT_PHOTO_LABEL.casefold() not in labels:
        rows.insert(0, {
            'label': PASSPORT_PHOTO_LABEL,
            'description': 'JPEG, PNG ou WebP',
            'required': True,
        })
    if university and IDENTITY_CARD_LABEL.casefold() not in labels:
        rows.insert(1, {'label': IDENTITY_CARD_LABEL, 'description': 'PDF', 'required': True})
    return rows
UNIVERSITY_CATEGORY_SLUG = 'universite'


def is_university_business(business):
    return getattr(getattr(business, 'primary_category', None), 'slug', '') == UNIVERSITY_CATEGORY_SLUG


def university_study_years(program):
    """Niveaux du programme. Les libellés enregistrés priment sur le modèle du cycle."""
    custom = [
        str(item).strip()
        for item in (getattr(program, 'study_year_labels', None) or [])
        if str(item).strip()
    ]
    if custom:
        return custom[:len(_ROMAN)]
    defaults = {'LICENCE': 3, 'MASTER': 2, 'DOCTORATE': 3, 'CERTIFICATE': 1}
    raw = getattr(program, 'duration_years', None)
    try:
        count = int(raw) if raw is not None else 0
    except (TypeError, ValueError):
        count = 0
    if count <= 0:
        count = defaults.get(getattr(program, 'level', ''), 1)
    count = max(1, min(count, len(_ROMAN)))
    prefix = {
        'LICENCE': 'BAC',
        'MASTER': 'Master',
        'DOCTORATE': 'Doctorat',
        'CERTIFICATE': 'Année',
    }.get(getattr(program, 'level', ''), 'Année')
    return [f'{prefix} {_ROMAN[index]}' for index in range(count)]


def _parse_birth(raw):
    from datetime import datetime as date_time
    raw = str(raw or '').strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return date_time.strptime(raw[:10], fmt).date()
        except ValueError:
            continue
    return None


def _percent(raw, field):
    text = str(raw or '').strip().replace(',', '.')
    if not text:
        raise ValidationError({field: 'Indiquez la note en pourcentage.'})
    try:
        value = float(text)
    except ValueError as exc:
        raise ValidationError({field: 'La note doit être un pourcentage.'}) from exc
    if value < 0 or value > 100:
        raise ValidationError({field: 'La note doit être comprise entre 0 et 100.'})
    return text


def read_university_candidature(data, program):
    """Champs du formulaire d'inscription université, sur le modèle BIU."""
    first = str(data.get('first_name') or '').strip()
    middle = str(data.get('middle_name') or '').strip()
    last = str(data.get('last_name') or '').strip()
    if not first:
        raise ValidationError({'first_name': 'Indiquez le prénom.'})
    if not last:
        raise ValidationError({'last_name': 'Indiquez le nom.'})
    birth = _parse_birth(data.get('birth_date'))
    if birth is None:
        raise ValidationError({'birth_date': 'Indiquez la date de naissance.'})
    gender = str(data.get('gender') or '').strip().upper()[:1]
    if gender not in ('F', 'M'):
        raise ValidationError({'gender': 'Indiquez le sexe.'})
    nationality = str(data.get('nationality') or '').strip()[:20]
    if not nationality:
        raise ValidationError({'nationality': 'Indiquez la nationalité.'})
    marital = str(data.get('marital_status') or '').strip()[:40]
    if marital not in ('Célibataire', 'Marié(e)'):
        raise ValidationError({'marital_status': 'Indiquez l’état civil.'})
    avenue = str(data.get('avenue') or '').strip()[:120]
    zone = str(data.get('zone') or '').strip()[:120]
    commune = str(data.get('commune') or '').strip()[:120]
    province = str(data.get('province') or '').strip()[:120]
    country = str(data.get('country') or '').strip()[:80]
    if not all((avenue, zone, commune, province, country)):
        raise ValidationError({'student_address': 'Indiquez l’adresse complète.'})
    previous_school = str(data.get('previous_school') or '').strip()[:200]
    if not previous_school:
        raise ValidationError({'previous_school': 'Indiquez le dernier établissement fréquenté.'})
    declared = str(data.get('studies_declared') or '').strip()
    if declared not in ('Oui', 'Non'):
        raise ValidationError({'studies_declared': 'Indiquez si ces études ont déjà été déclarées.'})
    guardian_link = str(data.get('guardian_link') or '').strip()[:40]
    guardian_name = str(data.get('guardian_name') or '').strip()[:200]
    guardian_email = str(data.get('guardian_email') or '').strip()[:254]
    guardian_phone = str(data.get('guardian_phone') or '').strip()[:40]
    guardian_address = str(data.get('guardian_address') or '').strip()[:120]
    if not guardian_link or not guardian_name or not guardian_phone or not guardian_address or not guardian_email:
        raise ValidationError({'guardian_name': 'Indiquez une personne de contact complète.'})
    years = university_study_years(program)
    study_year = str(data.get('study_year') or '').strip()
    if study_year not in years:
        raise ValidationError({'study_year': 'Choisissez le niveau d’inscription.'})
    options = [str(item).strip() for item in (program.options or []) if str(item).strip()]
    option = str(data.get('program_option') or '').strip()
    if options and option not in options:
        raise ValidationError({'program_option': 'Choisissez une option du programme.'})
    ack = str(data.get('terms_ack') or '').strip().lower()
    if ack not in ('1', 'true', 'yes', 'on'):
        raise ValidationError({'terms_ack': 'Confirmez avoir lu les conditions d’inscription.'})
    address = ', '.join([avenue, zone, commune, province, country])
    name = ' '.join(part for part in (first, middle, last) if part)
    return {
        'student_name': name[:200],
        'birth_date': birth,
        'gender': gender,
        'previous_school': previous_school,
        'student_address': address[:255],
        'guardian_name': guardian_name,
        'guardian_phone': guardian_phone,
        'guardian_link': guardian_link,
        'profile_details': {
            'first_name': first,
            'middle_name': middle,
            'last_name': last,
            'nationality': nationality,
            'marital_status': marital,
            'avenue': avenue,
            'zone': zone,
            'commune': commune,
            'province': province,
            'country': country,
            'last_percent': _percent(data.get('last_percent'), 'last_percent'),
            'state_exam_percent': _percent(data.get('state_exam_percent'), 'state_exam_percent'),
            'studies_declared': declared,
            'guardian_email': guardian_email,
            'guardian_address': guardian_address,
            'study_year': study_year,
            'program_option': option,
            'terms_accepted': True,
        },
    }


def _mail_to(email, subject, body, *, from_name=None, reply_to=None):
    email = (email or '').strip()
    if email:
        send_isoko_mail(subject, body, [email], from_name=from_name, reply_to=reply_to)


def _school_reply_email(campaign):
    business = campaign.business
    profile = getattr(business, 'education_profile', None)
    for raw in (
        getattr(profile, 'institutional_email', '') if profile else '',
        getattr(business, 'email', ''),
    ):
        email = (raw or '').strip()
        if email:
            return email
    return ''


DEFAULT_RECEIVED_MESSAGE = (
    'Bonjour {student_name},\n\n'
    '{school_name} confirme que votre dossier d’inscription est bien arrivé.\n'
    '{wait_note}\n\n'
    'Parcours : {title}\n'
    'Année scolaire : {academic_year}\n'
    '{criteria}'
    'Suivez votre dossier ici :\n{dossier_url}\n\n'
    '— {school_name}'
)
DEFAULT_REFUSAL_MESSAGE = (
    'Bonjour {student_name},\n\n'
    '{school_name} ne peut pas accepter votre dossier pour {title} ({academic_year}).\n\n'
    'Motif : {note}\n\n'
    'Suivre le dossier : {dossier_url}\n\n'
    '— {school_name}'
)
DEFAULT_ACCEPTED_MESSAGE = (
    'Bonjour {student_name},\n\n'
    '{school_name} accepte votre inscription pour {title} ({academic_year}).\n\n'
    'Motif : {note}\n\n'
    'Suivre le dossier : {dossier_url}\n\n'
    '— {school_name}'
)
ENROLLMENT_MESSAGE_PLACEHOLDERS = [
    '{student_name}', '{school_name}', '{title}', '{academic_year}',
    '{note}', '{dossier_url}', '{wait_note}', '{criteria}',
]


def school_message_defaults():
    return {
        'received': DEFAULT_RECEIVED_MESSAGE,
        'refusal': DEFAULT_REFUSAL_MESSAGE,
        'accepted': DEFAULT_ACCEPTED_MESSAGE,
    }


def message_defaults(business=None):
    if is_university_business(business):
        return {
            'received': (
                'Bonjour {student_name},\n\n'
                '{school_name} confirme que votre dossier d’inscription est bien arrivé.\n'
                '{wait_note}\n\n'
                'Programme : {title}\n'
                'Année académique : {academic_year}\n'
                'Suivez votre dossier ici :\n{dossier_url}\n\n'
                '— {school_name}'
            ),
            'refusal': (
                'Bonjour {student_name},\n\n'
                '{school_name} ne peut pas accepter votre dossier pour {title} ({academic_year}).\n\n'
                'Suivre le dossier : {dossier_url}\n\n'
                '— {school_name}'
            ),
            'accepted': (
                'Bonjour {student_name},\n\n'
                '{school_name} accepte votre inscription pour {title} ({academic_year}).\n\n'
                'Suivre le dossier : {dossier_url}\n\n'
                '— {school_name}'
            ),
        }
    return school_message_defaults()


def render_school_message(template, application, *, name='', note='', criteria_lines=''):
    campaign = application.campaign
    school_name = campaign.business.name
    if getattr(application, '_class_full', False):
        wait_note = (
            'La classe est complète : vous êtes sur la liste d’attente. '
            'L’école vous écrira si une place se libère.'
        )
    elif application.status == 'LISTE_ATTENTE' or application.campaign.program_id:
        who = 'L’université' if is_university_business(campaign.business) else 'L’école'
        wait_note = f'Votre dossier est en liste d’attente. {who} va l’accepter ou le refuser.'
    else:
        wait_note = ''
    values = {
        'student_name': name or application.student_name or 'Élève',
        'school_name': school_name,
        'title': _application_title(application),
        'academic_year': campaign.academic_year,
        'note': (note or '').strip(),
        'dossier_url': dossier_url(application),
        'wait_note': wait_note,
        'criteria': criteria_lines or '',
    }
    message = str(template or '')
    for key, value in values.items():
        message = message.replace('{' + key + '}', str(value))
    lines = [
        line for line in message.splitlines()
        if line.strip() not in ('Motif :', 'Motif:')
    ]
    return '\n'.join(lines).strip()


def school_message_template(business, kind):
    profile = getattr(business, 'education_profile', None)
    field = {
        'received': 'enrollment_received_message',
        'refusal': 'enrollment_refusal_message',
        'accepted': 'enrollment_accepted_message',
    }[kind]
    custom = (getattr(profile, field, '') or '').strip() if profile else ''
    return custom or message_defaults(business)[kind]


def _confirm_arrival_to_student(application, name, criteria_lines=''):
    """L'école confirme à l'élève que le dossier est bien arrivé."""
    campaign = application.campaign
    school_name = campaign.business.name
    body = render_school_message(
        school_message_template(campaign.business, 'received'),
        application, name=name, criteria_lines=criteria_lines,
    )
    _mail_to(
        _application_email(application) or getattr(application, 'student_email', ''),
        f'{school_name} — votre dossier est bien arrivé',
        body,
        from_name=school_name,
        reply_to=_school_reply_email(campaign) or None,
    )
    _notify_establishment(application, name)


def _notify_establishment(application, name):
    """Prévenir l'établissement. Le candidat seul ne suffit pas : l'admin ne lit pas sa boîte."""
    campaign = application.campaign
    student = (_application_email(application) or getattr(application, 'student_email', '') or '').strip()
    recipients = []
    for raw in (
        _school_reply_email(campaign),
        getattr(getattr(campaign.business, 'owner', None), 'email', ''),
    ):
        email = (raw or '').strip()
        if email and email.lower() not in {item.lower() for item in recipients} and email.lower() != student.lower():
            recipients.append(email)
    if not recipients:
        return
    title = _application_title(application)
    body = (
        f'Une candidature vient d’arriver pour {campaign.business.name}.\n\n'
        f'Candidat : {name or application.student_name}\n'
        f'E-mail : {student or "—"}\n'
        f'Téléphone : {application.student_phone or "—"}\n'
        f'Formation : {title}\n'
        f'Année : {campaign.academic_year}\n\n'
        f'Ouvrez Candidatures, file Liste d’attente.'
    )
    for email in recipients:
        _mail_to(
            email,
            f'{campaign.business.name} — nouvelle candidature',
            body,
            from_name='Isoko Hub',
        )


def _application_email(application):
    return (application.student_email or '').strip() or (
        application.applicant.email if application.applicant_id else ''
    )


def _application_title(application):
    campaign = application.campaign
    if campaign.program_id:
        return campaign.program.title
    if application.track:
        return track_label(application.track)
    return f"l'année scolaire {campaign.academic_year}"


def enrollment_fee_for_campaign(campaign):
    """Frais de cette inscription. Une année scolaire peut en avoir deux : payante et gratuite."""
    linked = EducationFee.objects.filter(campaign=campaign).order_by('-is_required').first()
    if linked:
        return linked
    qs = EducationFee.objects.filter(
        business_id=campaign.business_id,
        is_public=True,
        is_required=True,
        academic_year__iexact=campaign.academic_year,
        campaign__isnull=True,
    )
    if campaign.program_id:
        return qs.filter(program_id=campaign.program_id).order_by('amount_bif').first()
    qs = qs.filter(program__isnull=True)
    mode = (getattr(campaign, 'fee_mode', '') or '').upper()
    if mode == 'PAYANT':
        qs = qs.filter(amount_bif__gt=0)
    elif mode == 'GRATUIT':
        qs = qs.filter(amount_bif=0)
    return qs.order_by('amount_bif').first()


def resolve_school_track_fields(campaign, track, ecofo_year, post_section, post_year, profile):
    track = (track or '').strip()
    ecofo_year = (ecofo_year or '').strip()
    post_section = (post_section or '').strip()
    post_year = (post_year or '').strip()
    if campaign.program_id is not None:
        return '', '', '', '', list(campaign.required_documents or []), False

    open_tracks = campaign.open_tracks or open_tracks_from_plan(campaign.enrollment_plan)
    if not track:
        raise ValidationError({'track': 'Choisissez un parcours d’inscription.'})
    if track not in open_tracks:
        raise ValidationError({'track': 'Ce parcours n’est pas ouvert pour cette année scolaire.'})
    allowed = set(offered_tracks(profile))
    if track not in allowed:
        raise ValidationError({'track': 'Ce parcours n’est pas proposé par l’école.'})

    options = enrollment_options_for_campaign(campaign, profile)

    if track == TRACK_ECOFO:
        allowed_years = {row['value'] for row in options['ecofo_years']}
        if not allowed_years:
            raise ValidationError({'ecofo_year': 'Aucune année ECOFO n’est ouverte pour cette inscription.'})
        if ecofo_year not in allowed_years:
            raise ValidationError({'ecofo_year': 'Choisissez une année ouverte pour cette inscription.'})
        post_section = ''
        post_year = ''
    elif track == TRACK_POST:
        sections = {row['name']: row for row in options['post_sections']}
        if not post_section:
            raise ValidationError({'post_section': 'Choisissez une section post-fondamental.'})
        if post_section not in sections:
            raise ValidationError({'post_section': 'Cette section n’est pas ouverte cette année.'})
        allowed_years = {row['value'] for row in sections[post_section]['years']}
        if not post_year:
            raise ValidationError({'post_year': 'Choisissez l’année dans cette section.'})
        if post_year not in allowed_years:
            raise ValidationError({'post_year': 'Cette année n’est pas ouverte pour cette section.'})
        ecofo_year = ''
    else:
        ecofo_year = ''
        post_section = ''
        post_year = ''

    on_waitlist = slot_is_full(campaign, track, ecofo_year, post_section, post_year)

    from .school_enrollment_docs import resolved_school_documents
    docs = resolved_school_documents(
        campaign,
        track,
        ecofo_year if track == TRACK_ECOFO else post_year,
        post_section if track == TRACK_POST else '',
    )
    return track, ecofo_year, post_section, post_year, docs, on_waitlist


def dossier_url(application):
    from django.conf import settings
    base = (getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173').rstrip('/')
    return f'{base}/education/dossier?token={application.access_token}'


def store_document(application, uploaded, label, *, allow_extra=False):
    label = (label or '').strip()
    if not label:
        raise ValidationError({'label': 'Indiquez le nom de la pièce.'})
    expected = application_document_labels(application)
    if expected and label not in expected and not allow_extra:
        raise ValidationError({'label': f'Pièce non demandée : {label}'})
    try:
        validate_binary_upload(uploaded)
    except DjangoValidationError as exc:
        message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
        raise ValidationError({'document': message}) from exc
    existing = application.files.filter(label=label).first()
    if existing:
        existing.file.save(uploaded.name, uploaded, save=True)
        return existing
    return EnrollmentDocument.objects.create(application=application, label=label, file=uploaded)


def apply_public_candidature(*, campaign, actor, data, files_by_label):
    from .rls import allow_write
    allow_write(campaign.business_id)
    """Formulaire public one-shot : candidature envoyée + pièces + e-mail."""
    if not campaign.is_public:
        raise ValidationError({'campaign': 'Cette campagne n’est pas ouverte au public.'})
    if not campaign_open(campaign):
        raise ValidationError({'campaign': 'Les inscriptions sont fermées pour cette année.'})

    profile = getattr(campaign.business, 'education_profile', None)
    published_school = (
        campaign.program_id is None
        and profile
        and profile.publication_status == PublicationStatus.PUBLISHED
    )
    if campaign.program_id is None and not published_school:
        raise ValidationError({'campaign': 'Cette école n’est pas publiée.'})

    name = (data.get('student_name') or '').strip()
    email = (data.get('student_email') or '').strip().lower()
    phone = (data.get('student_phone') or '').strip()
    if actor and getattr(actor, 'is_authenticated', False) and getattr(actor, 'role', '') == 'CUSTOMER':
        name = name or f'{getattr(actor, "first_name", "")} {getattr(actor, "last_name", "")}'.strip()
        email = email or (actor.email or '').strip().lower()
        phone = phone or (getattr(actor, 'phone_number', None) or '')
        applicant = actor
    else:
        applicant = None

    birth = None
    gender = ''
    previous_school = ''
    student_address = ''
    guardian_name = ''
    guardian_phone = ''
    guardian_link = ''
    profile_details = {}
    if campaign.program_id is None:
        raw_birth = str(data.get('birth_date') or '').strip()
        birth = None
        from datetime import datetime as date_time
        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
            try:
                birth = date_time.strptime(raw_birth[:10], fmt).date()
                break
            except ValueError:
                continue
        if birth is None:
            raise ValidationError({'birth_date': 'Indiquez la date de naissance de l’élève.'})
        gender = str(data.get('gender') or '').strip().upper()[:1]
        if gender not in ('F', 'M'):
            raise ValidationError({'gender': 'Indiquez le sexe de l’élève.'})
        guardian_name = str(data.get('guardian_name') or '').strip()
        guardian_phone = str(data.get('guardian_phone') or '').strip()
        guardian_link = str(data.get('guardian_link') or '').strip()
        previous_school = str(data.get('previous_school') or '').strip()
        student_address = str(data.get('student_address') or '').strip()
        if not guardian_name:
            raise ValidationError({'guardian_name': 'Indiquez le parent ou le tuteur.'})
        if not guardian_phone:
            raise ValidationError({'guardian_phone': 'Indiquez le téléphone du parent ou du tuteur.'})
    else:
        university = read_university_candidature(data, campaign.program)
        name = university['student_name']
        birth = university['birth_date']
        gender = university['gender']
        previous_school = university['previous_school']
        student_address = university['student_address']
        guardian_name = university['guardian_name']
        guardian_phone = university['guardian_phone']
        guardian_link = university['guardian_link']
        profile_details = university['profile_details']
        for label, uploaded in files_by_label.items():
            filename = (getattr(uploaded, 'name', '') or '').lower()
            if is_passport_photo(label):
                continue
            if not filename.endswith('.pdf'):
                raise ValidationError({'document': f'{label} doit être un fichier PDF.'})

    for label, uploaded in files_by_label.items():
        if not is_passport_photo(label):
            continue
        filename = (getattr(uploaded, 'name', '') or '').lower()
        if not filename.endswith(_PHOTO_EXTENSIONS):
            raise ValidationError({
                'document': 'La photo passeport doit être une image JPEG, PNG ou WebP.',
            })

    if not name:
        raise ValidationError({'student_name': 'Indiquez le nom de l’élève.'})
    if not email:
        raise ValidationError({'student_email': 'Indiquez un e-mail pour recevoir la confirmation.'})
    if not phone:
        raise ValidationError({'student_phone': 'Indiquez un numéro de téléphone.'})

    existing = EnrollmentApplication.objects.filter(
        campaign=campaign, student_email__iexact=email,
    ).exclude(student_email='').first()
    if existing:
        raise ValidationError({
            'student_email': 'Un dossier existe déjà pour cet e-mail sur cette année.',
            'suivi_url': dossier_url(existing),
        })

    try:
        track, ecofo_year, post_section, post_year, docs, on_waitlist = resolve_school_track_fields(
            campaign,
            data.get('track'),
            data.get('ecofo_year'),
            data.get('post_section'),
            data.get('post_year'),
            profile,
        )
    except DjangoValidationError as exc:
        message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
        raise ValidationError({'track': message}) from exc

    school = campaign.program_id is None
    status = 'LISTE_ATTENTE' if school else 'ENVOYEE'
    class_full = bool(school and on_waitlist)

    docs = with_standard_pieces(docs, university=not school)

    needed = [item.get('label', '').strip() for item in docs if item.get('label')]
    missing = [label for label in needed if label not in files_by_label]
    if missing:
        raise ValidationError({'document': 'Pièces manquantes : ' + ', '.join(missing)})

    criteria = normalize_extra_criteria(campaign.extra_criteria)
    ack_raw = str(data.get('criteria_ack') or '').strip().lower()
    acknowledged = ack_raw in ('1', 'true', 'yes', 'on')
    if criteria and not acknowledged:
        raise ValidationError({
            'criteria_ack': 'Confirmez que vous avez pris connaissance des critères supplémentaires (ex. test de sélection).',
        })

    try:
        with transaction.atomic():
            application = EnrollmentApplication.objects.create(
                business=campaign.business,
                campaign=campaign,
                applicant=applicant,
                student_name=name[:200],
                student_email=email[:254],
                student_phone=phone[:40],
                birth_date=birth,
                gender=gender,
                previous_school=previous_school[:200],
                student_address=student_address[:255],
                guardian_name=guardian_name[:200],
                guardian_phone=guardian_phone[:40],
                guardian_link=guardian_link[:40],
                track=track,
                ecofo_year=ecofo_year,
                post_section=post_section,
                post_year=post_year,
                required_documents=docs,
                profile_details=profile_details,
                criteria_acknowledged=bool(criteria and acknowledged),
                status=status,
            )
            from .audit import audit_education
            audit_education(
                'EDUCATION_APPLICATION_CREATE', campaign.business,
                f'education.application:{application.pk}', user=actor,
                academic_year=campaign.academic_year,
            )
            for label, uploaded in files_by_label.items():
                if label in needed:
                    store_document(application, uploaded, label)
            EnrollmentEvent.objects.create(
                application=application,
                actor=applicant,
                from_status='BROUILLON',
                to_status=status,
                note=(
                    'Classe complète : dossier placé en liste d’attente'
                    if class_full
                    else (
                        'Dossier reçu, en liste d’attente'
                        if status == 'LISTE_ATTENTE'
                        else 'Candidature envoyée via le formulaire public'
                    )
                ),
            )
    except IntegrityError as exc:
        raise ValidationError({
            'campaign': 'Une candidature existe déjà pour cet e-mail sur cette année.',
        }) from exc

    try:
        from .dossier_pdf import store_compiled_dossier
        store_compiled_dossier(application)
    except Exception:
        logger.exception('Dossier PDF non généré pour %s', application.pk)

    criteria_lines = ''
    if criteria:
        lines = []
        for item in criteria:
            bits = [item['label']]
            if item.get('date'):
                bits.append(item['date'])
            if item.get('place'):
                bits.append(item['place'])
            if item.get('details'):
                bits.append(item['details'])
            lines.append(' · '.join(bits))
        criteria_lines = (
            '\nCritères supplémentaires de l’école :\n- '
            + '\n- '.join(lines)
            + '\n'
        )
    application._class_full = class_full
    _confirm_arrival_to_student(application, name, criteria_lines)
    return application


def submit_application(application, actor):
    if application.applicant_id != actor.id:
        raise ValidationError({'detail': 'Cette demande ne vous appartient pas.'})
    if application.status != 'BROUILLON':
        raise ValidationError({'detail': 'Seule une demande brouillon peut être envoyée.'})
    campaign = application.campaign
    if not campaign_open(campaign):
        raise ValidationError({'detail': 'Les inscriptions sont fermées pour cette formation.'})
    needed = application_document_labels(application)
    uploaded = set(application.files.values_list('label', flat=True))
    missing = [label for label in needed if label not in uploaded]
    if missing:
        raise ValidationError({'document': 'Pièces manquantes : ' + ', '.join(missing)})
    previous = application.status
    application.status = 'ENVOYEE'
    application.save(update_fields=['status', 'updated_at'])
    EnrollmentEvent.objects.create(
        application=application, actor=actor, from_status=previous, to_status='ENVOYEE',
    )
    _confirm_arrival_to_student(application, application.student_name or '')
    return application


def decide_application(application, actor, new_status, note=''):
    if new_status == application.status:
        return application
    allowed = STAFF_NEXT.get(application.status, set())
    if new_status not in allowed:
        raise ValidationError({
            'status': 'Ce dossier est déjà « {} ». Cette action n’est plus possible.'.format(
                dict(EnrollmentApplication.STATUS).get(application.status, application.status),
            ),
        })
    school = application.campaign.program_id is None
    university = is_university_business(application.campaign.business)
    templated = school or university
    if new_status == 'REFUSEE' and application.status in ('ACCEPTEE', 'CONFIRMEE') and templated:
        raise ValidationError({'status': 'Une inscription déjà acceptée ne peut plus être refusée.'})
    if new_status == 'REFUSEE' and not templated and not (note or '').strip():
        raise ValidationError({'note': 'Le motif de refus est obligatoire.'})
    if new_status == 'COMPLEMENT_DEMANDE' and not (note or '').strip():
        raise ValidationError({'note': 'Indiquez la pièce ou l’information demandée.'})
    if new_status == 'ACCEPTEE' and application.status not in ('ACCEPTEE', 'CONFIRMEE'):
        try:
            full = slot_is_full(
                application.campaign, application.track,
                application.ecofo_year, application.post_section, application.post_year,
            )
        except DjangoValidationError as exc:
            message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
            raise ValidationError({'track': message}) from exc
        if full:
            raise ValidationError({
                'status': 'Plus de place dans cette classe. Libérez une place avant d’accepter cette liste d’attente.',
            })
    previous = application.status
    application.status = new_status
    application.decision_note = (note or '')[:2000]
    application.save(update_fields=['status', 'decision_note', 'updated_at'])
    EnrollmentEvent.objects.create(
        application=application, actor=actor, from_status=previous,
        to_status=new_status, note=(note or '')[:500],
    )
    subject, intro = DECISION_MAIL.get(
        new_status,
        ('Mise à jour de votre dossier', f'Votre demande passe au statut {new_status}.'),
    )
    title = _application_title(application)
    school_name = application.campaign.business.name
    if templated and new_status == 'ACCEPTEE':
        body = render_school_message(
            school_message_template(application.campaign.business, 'accepted'),
            application, note=note,
        )
    elif templated and new_status == 'REFUSEE':
        body = render_school_message(
            school_message_template(application.campaign.business, 'refusal'),
            application, note=note,
        )
    else:
        body = (
            f'{intro}\n\n'
            f'Dossier : {title} ({application.campaign.academic_year})\n'
            f'{("Motif : " + note) if note else ""}\n'
            f'Suivre le dossier : {dossier_url(application)}\n\n'
            f'— {school_name}'
        ).strip()
    _mail_to(
        _application_email(application),
        f'{school_name} — {subject}',
        body,
        from_name=school_name,
        reply_to=_school_reply_email(application.campaign) or None,
    )
    return application


def public_dossier(application, request=None):
    fee = enrollment_fee_for_campaign(application.campaign)
    payment = application.fee_payments.order_by('-id').first()
    amount = int(fee.amount_bif) if fee else 0
    if amount <= 0:
        pay_status = 'WAIVED'
    else:
        pay_status = payment.status if payment else 'UNPAID'
    files = []
    for document in application.files.all():
        url = document.file.url if document.file else ''
        if url and request is not None:
            url = request.build_absolute_uri(url)
        files.append({
            'label': document.label,
            'url': url,
            'uploaded_at': document.uploaded_at,
        })
    return {
        'student_name': application.student_name,
        'student_email': application.student_email,
        'school_name': application.business.name,
        'academic_year': application.campaign.academic_year,
        'title': _application_title(application),
        'status': application.status,
        'status_label': dict(EnrollmentApplication.STATUS).get(application.status, application.status),
        'decision_note': application.decision_note,
        'files': files,
        'payment': {
            'status': pay_status,
            'amount_bif': amount,
            'label': fee.label if fee else 'Frais d’inscription',
        },
        'can_upload_complement': application.status == 'COMPLEMENT_DEMANDE',
    }


def application_by_access_token(token):
    token = (token or '').strip()
    if not token:
        return None
    from .rls import allow_dossier_token
    allow_dossier_token(token)
    return EnrollmentApplication.objects.select_related(
        'campaign', 'campaign__business', 'campaign__program', 'business',
    ).prefetch_related('files', 'fee_payments').filter(access_token=token).first()


def receive_complement(application, uploaded, label):
    """Pièce ajoutée par l’élève quand l’école a demandé un complément."""
    if application.status != 'COMPLEMENT_DEMANDE':
        raise ValidationError({'detail': 'Aucun complément n’est demandé sur ce dossier.'})
    document = store_document(application, uploaded, label, allow_extra=True)
    previous = application.status
    application.status = 'EN_INSTRUCTION'
    application.save(update_fields=['status', 'updated_at'])
    EnrollmentEvent.objects.create(
        application=application,
        from_status=previous,
        to_status='EN_INSTRUCTION',
        note=f'Complément reçu : {document.label}'[:500],
    )
    return document


def attach_document(application, uploaded, actor, label=''):
    if not application.applicant_id or application.applicant_id != actor.id:
        raise ValidationError({'detail': 'Cette demande ne vous appartient pas.'})
    if application.status in EnrollmentApplication.FINAL:
        raise ValidationError({'detail': 'Le dossier est clos.'})
    return store_document(application, uploaded, label)


def start_fee_payment(fee, applicant, payer_phone, application=None):
    if not burundipay.is_valid_payer_phone(payer_phone):
        raise ValidationError({
            'payer_phone': 'Numéro BurundiPay invalide. Saisissez 8 chiffres ou 257 suivi de 8 chiffres.',
        })
    if not fee.is_public:
        raise ValidationError({'detail': 'Ce frais n’est pas ouvert au paiement.'})
    phone = burundipay.normalize_phone(payer_phone)
    merchant = education_merchant_account(fee.business)
    from .rls import allow_write
    allow_write(fee.business_id)

    with transaction.atomic():
        payment = _lock_fee_payment(fee, applicant, application)
        if payment is None:
            try:
                with transaction.atomic():
                    payment = EducationFeePayment.objects.create(
                        fee=fee,
                        applicant=applicant,
                        application=application,
                        status='UNPAID',
                        payment_token=issue_payment_token(),
                    )
            except IntegrityError:
                payment = _lock_fee_payment(fee, applicant, application)
                if payment is None:
                    raise
        if payment.status == 'PAID':
            return payment, {'ok': True, 'already_paid': True, 'message': 'Déjà payé.'}
        if (
            payment.status == 'AWAITING_PIN'
            and payment.payer_phone == phone
            and payment.provider_reference
        ):
            return payment, {
                'ok': True,
                'already_started': True,
                'message': 'Paiement déjà lancé. Confirmez le code reçu.',
            }

    result = burundipay.initiate_collection(
        amount_bif=int(fee.amount_bif),
        payer_phone=phone,
        external_id=f'edu-{payment.id}',
        description=fee.label[:80],
        merchant=merchant,
    )
    with transaction.atomic():
        locked = EducationFeePayment.objects.select_for_update().get(pk=payment.pk)
        if locked.status == 'PAID':
            return locked, {'ok': True, 'already_paid': True, 'message': 'Déjà payé.'}
        locked.payer_phone = phone
        locked.method = 'BURUNDIPAY'
        locked.merchant_account = merchant
        if not locked.payment_token:
            locked.payment_token = issue_payment_token()
        if result.get('ok'):
            locked.status = result.get('status') or 'AWAITING_PIN'
            locked.provider_reference = result.get('provider_reference') or ''
        else:
            locked.status = 'FAILED'
        locked.save(update_fields=[
            'payer_phone', 'method', 'merchant_account', 'status',
            'provider_reference', 'payment_token', 'applicant', 'application',
        ])
    return locked, result


def _lock_fee_payment(fee, applicant, application):
    """Une seule ligne de paiement par dossier, verrouillée le temps de l'écriture."""
    if application is not None:
        return (
            EducationFeePayment.objects.select_for_update()
            .filter(fee=fee, application=application)
            .order_by('id')
            .first()
        )
    if applicant is not None:
        return (
            EducationFeePayment.objects.select_for_update()
            .filter(fee=fee, applicant=applicant, application__isnull=True)
            .order_by('id')
            .first()
        )
    return None


def ensure_bordereau_pdf(uploaded):
    """Refuse tout fichier qui n’est pas un PDF, avant d’enregistrer le dossier."""
    from config.uploads import validate_binary_upload
    if not uploaded:
        raise ValidationError({'bordereau': 'Joignez le bordereau en PDF.'})
    try:
        ext = validate_binary_upload(uploaded)
    except DjangoValidationError as exc:
        message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
        raise ValidationError({'bordereau': message}) from exc
    if ext != '.pdf':
        raise ValidationError({'bordereau': 'Le bordereau doit être un PDF.'})
    if hasattr(uploaded, 'seek'):
        uploaded.seek(0)


def record_inscription_bordereau(fee, application, uploaded):
    """Reçoit le PDF du bordereau. Ce n’est pas un encaissement BurundiPay."""
    ensure_bordereau_pdf(uploaded)
    from .rls import allow_write
    allow_write(fee.business_id)
    with transaction.atomic():
        payment = _lock_fee_payment(fee, application.applicant, application)
        if payment and payment.status == 'PAID':
            raise ValidationError({'bordereau': 'Ce dossier est déjà payé par BurundiPay.'})
        if payment is None:
            payment = EducationFeePayment.objects.create(
                fee=fee,
                applicant=application.applicant,
                application=application,
                status='BORDEREAU_RECU',
                method='BORDEREAU',
                payment_token=issue_payment_token(),
            )
        payment.status = 'BORDEREAU_RECU'
        payment.method = 'BORDEREAU'
        payment.payer_phone = ''
        payment.bordereau.save(getattr(uploaded, 'name', '') or 'bordereau.pdf', uploaded, save=False)
        payment.save(update_fields=['status', 'method', 'payer_phone', 'bordereau', 'applicant', 'application'])
    return payment


def confirm_fee_stub(payment):
    if not burundipay.is_stub_mode():
        raise ValidationError({'detail': 'Confirmation manuelle réservée au mode simulation.'})
    with transaction.atomic():
        locked = EducationFeePayment.objects.select_for_update().get(pk=payment.pk)
        if locked.status == 'PAID':
            return locked
        locked.status = 'PAID'
        locked.paid_at = timezone.now()
        locked.save(update_fields=['status', 'paid_at'])
    from config.metrics import incr
    incr('education_payments_confirmed')
    return locked


def payment_by_token(payment_id, payment_token):
    payment = EducationFeePayment.objects.select_related('fee', 'application').filter(pk=payment_id).first()
    if not payment:
        return None
    if payment_token and payment.payment_token and payment.payment_token == payment_token:
        return payment
    return None
