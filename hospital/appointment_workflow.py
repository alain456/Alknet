"""Workflow rendez-vous — notifications, audit et génération mensuelle."""
import calendar
from datetime import date, datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.services import log_audit_event
from businesses.models import BusinessEmployee
from .models import (
    Appointment, AppointmentSlot, DoctorProfile, DoctorSchedule, Notification,
    AppointmentEvent, AppointmentNotificationLog,
)

User = get_user_model()


def get_hospital_code(hospital):
    """Sigle hôpital pour la référence RDV-BAHO-2026-000128."""
    try:
        profile = getattr(hospital, 'hospital_profile', None)
        if profile is None:
            from .models import HospitalProfile
            profile = HospitalProfile.objects.filter(business_id=hospital.id).first()
        if profile and profile.acronym:
            return profile.acronym.upper().replace(' ', '')[:10]
    except Exception:
        pass
    name = (hospital.name or 'HOP').upper()
    parts = [p for p in name.replace('-', ' ').split() if p]
    if len(parts) >= 2:
        return ''.join(p[:3] for p in parts[:2])[:10]
    return parts[0][:6] if parts else 'HOP'


def get_reference_prefix(hospital):
    """Préfixe configurable par l'admin (défaut RDV)."""
    try:
        profile = getattr(hospital, 'hospital_profile', None)
        if profile is None:
            from .models import HospitalProfile
            profile = HospitalProfile.objects.filter(business_id=hospital.id).first()
        if profile and profile.appointment_reference_prefix:
            return profile.appointment_reference_prefix.upper().replace(' ', '')[:15]
    except Exception:
        pass
    return 'RDV'


APPOINTMENT_MESSAGE_PLACEHOLDERS = [
    '{patient_name}', '{reference}', '{queue_number}', '{hospital_name}',
    '{doctor_name}', '{appointment_date}', '{request_date}', '{reason}',
]

DEFAULT_BOOKING_ACK_TEMPLATE = (
    'Bonjour {patient_name},\n\n'
    'Votre demande de rendez-vous a bien été enregistrée.\n\n'
    'Numéro de suivi : {reference}\n'
    'Ordre de passage (session) : #{queue_number}\n'
    'Établissement : {hospital_name}\n'
    'Médecin : {doctor_name}\n'
    'Date du rendez-vous : {appointment_date}\n'
    'Motif : {reason}\n\n'
    'Vous serez notifié(e) par email dès que l\'administration aura validé ou refusé votre demande.\n'
    'Conservez votre numéro de suivi pour le jour de la consultation.\n\n'
    'Cordialement,\n'
    'L\'équipe de {hospital_name}'
)

DEFAULT_CONFIRMATION_TEMPLATE = (
    'Bonjour {patient_name},\n\n'
    'Votre rendez-vous a été confirmé par {hospital_name}.\n\n'
    'Numéro de suivi : {reference}\n'
    'Ordre de passage : #{queue_number}\n'
    'Médecin : {doctor_name}\n'
    'Date de votre demande : {request_date}\n'
    'Date du rendez-vous : {appointment_date}\n\n'
    'Présentez ce numéro à l\'accueil le jour de la consultation.\n\n'
    'Cordialement,\n'
    'L\'équipe de {hospital_name}'
)


def get_hospital_profile(hospital):
    profile = getattr(hospital, 'hospital_profile', None)
    if profile is None:
        from .models import HospitalProfile
        profile = HospitalProfile.objects.filter(business_id=hospital.id).first()
    return profile


def get_appointment_message_context(appointment):
    """Variables pour les modèles de messages email RDV."""
    appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    doctor_name = appointment.doctor.user.get_full_name()
    patient_name = get_patient_display_name(appointment)
    ref = appointment.reference_code or f'#{appointment.queue_number or "—"}'
    request_date = (
        appointment.created_at.strftime('%d/%m/%Y à %H:%M')
        if appointment.created_at else '—'
    )
    return {
        'patient_name': patient_name,
        'reference': ref,
        'queue_number': str(appointment.queue_number or '—'),
        'hospital_name': appointment.hospital.name,
        'doctor_name': doctor_name,
        'appointment_date': appt_label,
        'request_date': request_date,
        'reason': appointment.reason or 'Non précisé',
    }


def render_appointment_message_template(template, appointment):
    """Remplace les variables {…} dans un modèle de message."""
    if not template or not str(template).strip():
        return ''
    context = get_appointment_message_context(appointment)
    message = str(template)
    for key, value in context.items():
        message = message.replace('{' + key + '}', str(value))
    return message


def get_booking_ack_template(hospital):
    profile = get_hospital_profile(hospital)
    custom = (profile.appointment_request_ack_message or '').strip() if profile else ''
    return custom or DEFAULT_BOOKING_ACK_TEMPLATE


def build_booking_ack_message(appointment):
    return render_appointment_message_template(get_booking_ack_template(appointment.hospital), appointment)


def preview_next_appointment_reference(hospital):
    """Aperçu du prochain numéro de suivi sans le consommer."""
    year = timezone.now().year
    code = get_hospital_code(hospital)
    prefix = get_reference_prefix(hospital)
    ref_prefix = f'{prefix}-{code}-{year}-'
    existing = Appointment.objects.filter(
        reference_code__startswith=ref_prefix,
        hospital=hospital,
    ).values_list('reference_code', flat=True)
    max_num = 0
    for ref in existing:
        try:
            max_num = max(max_num, int(ref.rsplit('-', 1)[-1]))
        except (ValueError, IndexError):
            continue
    return f'{ref_prefix}{max_num + 1:06d}'


def generate_appointment_reference(hospital):
    """Génère un numéro de suivi unique (RDV-BAHO-2026-000128)."""
    return preview_next_appointment_reference(hospital)


def log_appointment_event(appointment, event_type, actor=None, comment='', previous_status='', new_status=''):
    """Enregistre un événement dans l'historique du rendez-vous."""
    return AppointmentEvent.objects.create(
        appointment=appointment,
        event_type=event_type,
        previous_status=previous_status or appointment.status,
        new_status=new_status or appointment.status,
        actor=actor,
        comment=comment or '',
    )


def log_appointment_notification(appointment, *, channel, notification_type, recipient=None, destination='', status='SENT', error_message=''):
    """Trace l'envoi d'une notification liée au rendez-vous."""
    return AppointmentNotificationLog.objects.create(
        appointment=appointment,
        recipient=recipient,
        channel=channel,
        notification_type=notification_type,
        destination=destination,
        status=status,
        error_message=error_message or '',
    )


def transition_appointment(appointment, new_status, *, actor=None, comment='', event_type='STATUS_CHANGED'):
    """Applique une transition validée et journalise l'événement."""
    previous = appointment.status
    if not appointment.can_transition_to(new_status):
        raise ValidationError({
            'status': f'Transition invalide : {previous} → {new_status}',
        })
    appointment.status = new_status
    appointment.save(update_fields=['status', 'updated_at'])
    log_appointment_event(
        appointment,
        event_type=event_type,
        actor=actor,
        comment=comment,
        previous_status=previous,
        new_status=new_status,
    )
    return appointment


def user_can_operate_clinical_workflow(user, hospital):
    """Accueil, infirmier, admin, owner — opérations file d'attente."""
    if not user or not user.is_authenticated:
        return False
    if user.role == 'SUPER_ADMIN':
        return False
    if hospital.owner_id == user.id:
        return True
    if user.role == 'BUSINESS_OWNER' and hospital.owner_id == user.id:
        return True
    return BusinessEmployee.objects.filter(
        Q(position__in=['ADMIN', 'RECEPTIONIST', 'NURSE', 'DIRECTION', 'GESTIONNAIRE', 'ACCUEIL'])
        | Q(role__system_access_level__in=['ADMIN_ACCESS', 'RECEPTIONIST_ACCESS'])
        | Q(role__permissions__contains='can_manage_hospital')
        | Q(role__permissions__contains='appointment.check_in'),
        business=hospital,
        user=user,
        is_active=True,
    ).exists()


def user_can_start_consultation(user, appointment):
    """Médecin du RDV ou admin hôpital."""
    if not user or not user.is_authenticated:
        return False
    if user_can_manage_hospital_appointments(user, appointment.hospital):
        return True
    if hasattr(user, 'doctor_profile') and appointment.doctor_id == user.doctor_profile.id:
        return True
    return False


def get_patient_display_name(appointment):
    if appointment.patient_contact_name and appointment.patient_contact_name.strip():
        return appointment.patient_contact_name.strip()
    return appointment.patient.get_full_name() or appointment.patient.email


def get_patient_contact_email(appointment):
    if appointment.patient_contact_email and appointment.patient_contact_email.strip():
        return appointment.patient_contact_email.strip()
    return appointment.patient.email


def smtp_error_message(exc):
    """Message d'erreur SMTP lisible pour l'admin."""
    msg = str(exc)
    if 'Application-specific password required' in msg or 'InvalidSecondFactor' in msg:
        return (
            'Gmail refuse le mot de passe du compte. Créez un mot de passe d\'application '
            '(16 caractères) sur https://myaccount.google.com/apppasswords , '
            'collez-le dans EMAIL_HOST_PASSWORD du fichier .env, puis exécutez : '
            'docker compose up -d --force-recreate web'
        )
    if 'Username and Password not accepted' in msg or '534' in msg or '535' in msg:
        return (
            'Identifiants Gmail incorrects. Utilisez un mot de passe d\'application Google, '
            'pas votre mot de passe de connexion habituel.'
        )
    if 'Invalid address' in msg:
        return 'Adresse expéditeur invalide. Vérifiez DEFAULT_FROM_EMAIL dans .env (entre guillemets).'
    return msg[:400]


def send_appointment_email(appointment, subject, message, notification_type='EMAIL'):
    """Envoie un email au patient. Retourne (succès, message_erreur)."""
    recipient = get_patient_contact_email(appointment)
    if not recipient:
        err = 'Aucune adresse email patient disponible'
        log_appointment_notification(
            appointment, channel='EMAIL', notification_type=notification_type,
            recipient=appointment.patient, destination='', status='FAILED', error_message=err,
        )
        return False, err
    if not getattr(settings, 'DEFAULT_FROM_EMAIL', ''):
        err = 'DEFAULT_FROM_EMAIL manquant dans .env'
        log_appointment_notification(
            appointment, channel='EMAIL', notification_type=notification_type,
            recipient=appointment.patient, destination=recipient, status='FAILED', error_message=err,
        )
        return False, err
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
        log_appointment_notification(
            appointment, channel='EMAIL', notification_type=notification_type,
            recipient=appointment.patient, destination=recipient, status='SENT',
        )
        return True, ''
    except Exception as exc:
        err = smtp_error_message(exc)
        log_appointment_notification(
            appointment, channel='EMAIL', notification_type=notification_type,
            recipient=appointment.patient, destination=recipient, status='FAILED', error_message=str(exc),
        )
        return False, err


def send_user_email(user, subject, message, appointment=None, notification_type='EMAIL'):
    """Envoie un email au personnel. Retourne (succès, message_erreur)."""
    if not user or not getattr(user, 'email', None):
        return False, 'Email du destinataire manquant'
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@isokohub.bi'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        if appointment:
            log_appointment_notification(
                appointment, channel='EMAIL', notification_type=notification_type,
                recipient=user, destination=user.email, status='SENT',
            )
        return True, ''
    except Exception as exc:
        err = smtp_error_message(exc)
        if appointment:
            log_appointment_notification(
                appointment, channel='EMAIL', notification_type=notification_type,
                recipient=user, destination=getattr(user, 'email', '') or '',
                status='FAILED', error_message=str(exc),
            )
        return False, err


def build_default_confirmation_message(appointment):
    """Message par défaut si l'admin n'en fournit pas."""
    return render_appointment_message_template(DEFAULT_CONFIRMATION_TEMPLATE, appointment)


def _employee_has_permission(employee, permission_key):
    perms = employee.role.permissions if employee.role else []
    if not isinstance(perms, list):
        return False
    return permission_key in perms


def user_is_receptionist(user, hospital):
    """Agent d'accueil — accès dashboard réception."""
    if not user or not user.is_authenticated:
        return False
    if hospital.owner_id == user.id:
        return False
    return BusinessEmployee.objects.filter(
        Q(position__in=['RECEPTIONIST', 'ACCUEIL'])
        | Q(role__system_access_level='RECEPTIONIST_ACCESS')
        | Q(role__permissions__contains='appointment.view_confirmed'),
        business=hospital,
        user=user,
        is_active=True,
    ).exists()


def user_has_appointment_permission(user, hospital, permission_key):
    if not user or not user.is_authenticated:
        return False
    if hospital.owner_id == user.id:
        return True
    employees = BusinessEmployee.objects.filter(
        business=hospital, user=user, is_active=True
    ).select_related('role')
    for emp in employees:
        if emp.role and emp.role.system_access_level == 'ADMIN_ACCESS':
            return True
        if emp.role and _employee_has_permission(emp, 'can_manage_hospital'):
            return True
        if _employee_has_permission(emp, permission_key):
            return True
    return False


def user_can_check_in_appointment(user, appointment):
    """Réceptionniste ou admin — enregistrer l'arrivée (RDV confirmé)."""
    if not user or not user.is_authenticated:
        return False
    if user.role == 'SUPER_ADMIN':
        return False
    hospital = appointment.hospital
    if hospital.owner_id == user.id:
        return True
    if user_can_manage_hospital_appointments(user, hospital):
        return True
    return BusinessEmployee.objects.filter(
        Q(position__in=['RECEPTIONIST', 'ACCUEIL'])
        | Q(role__system_access_level='RECEPTIONIST_ACCESS')
        | Q(role__permissions__contains='appointment.check_in'),
        business=hospital,
        user=user,
        is_active=True,
    ).exists()


def user_can_view_appointment_history(user, appointment):
    if user_can_manage_hospital_appointments(user, appointment.hospital):
        return True
    if getattr(appointment, 'patient_id', None) == user.id:
        return True
    # Réception (check-in) doit pouvoir consulter l'historique du dossier RDV.
    if user_can_check_in_appointment(user, appointment):
        return True
    employees = BusinessEmployee.objects.filter(
        business=appointment.hospital,
        user=user,
        is_active=True,
    ).select_related('role')
    for emp in employees:
        if emp.role and emp.role.system_access_level == 'RECEPTIONIST_ACCESS':
            return True
        # JSONField __contains='string' est fragile ; vérifier la liste Python.
        if _employee_has_permission(emp, 'appointment.view_audit'):
            return True
    return False


def user_can_manage_hospital_appointments(user, hospital):
    """
    Admin hôpital ou propriétaire — confirmer / refuser les RDV
    (pas le réceptionniste, pas le médecin, pas le Super Admin plateforme).
    """
    if not user or not getattr(user, 'is_authenticated', False) or not hospital:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN':
        return False

    user_id = str(getattr(user, 'id', '') or '')
    owner_id = str(getattr(hospital, 'owner_id', '') or '')
    hospital_id = getattr(hospital, 'pk', None) or getattr(hospital, 'id', None)

    # Propriétaire de l'établissement (comparaison str pour UUID / str)
    if user_id and owner_id and user_id == owner_id:
        return True

    # Compte propriétaire même si le reverse-FK businesses est utilisé (sécurité)
    if getattr(user, 'role', None) == 'BUSINESS_OWNER' and hospital_id:
        if user.businesses.filter(pk=hospital_id).exists():
            return True

    # Employé admin de cet hôpital
    return BusinessEmployee.objects.filter(
        Q(position__iexact='ADMIN')
        | Q(position__in=['ADMIN', 'DIRECTION', 'GESTIONNAIRE', 'Administrateur'])
        | Q(role__system_access_level='ADMIN_ACCESS')
        | Q(role__permissions__contains='can_manage_hospital')
        | Q(role__permissions__contains='appointment.confirm'),
        business_id=hospital_id,
        user=user,
        is_active=True,
    ).exists()


def get_hospital_staff_to_notify(hospital):
    """Propriétaire + employés admin de l'hôpital."""
    recipients = []
    if hospital.owner_id:
        recipients.append(hospital.owner)
    employees = BusinessEmployee.objects.filter(
        business=hospital, is_active=True
    ).select_related('user', 'role')
    for emp in employees:
        if emp.user_id == hospital.owner_id:
            continue
        is_admin = (
            (emp.role and emp.role.system_access_level == 'ADMIN_ACCESS')
            or (emp.role and emp.role.system_access_level == 'RECEPTIONIST_ACCESS')
            or emp.position.upper() in ('ADMIN', 'DIRECTION', 'GESTIONNAIRE', 'RECEPTIONIST', 'ACCUEIL')
        )
        if is_admin:
            recipients.append(emp.user)
    return list({u.id: u for u in recipients if u}.values())


def validate_slot_for_booking(slot):
    """Vérifie qu'un créneau est publié et réservable côté client."""
    if not slot.is_active:
        raise ValidationError({'slot': "Ce créneau n'est pas encore publié par l'administration."})
    if slot.status != 'OPEN':
        raise ValidationError({'slot': 'Ce créneau n\'accepte plus de réservations.'})
    if slot.slot_date < timezone.now().date():
        raise ValidationError({'slot': 'Ce créneau est expiré.'})
    if slot.remaining_slots <= 0:
        raise ValidationError({'slot': 'Ce créneau est complet.'})


def notify_appointment_booked(appointment, request=None, booked_by=None):
    """Notifie patient, médecin et admins après une postulation."""
    appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    doctor_name = appointment.doctor.user.get_full_name()
    patient_name = get_patient_display_name(appointment)
    ref = appointment.reference_code or f'#{appointment.queue_number or "—"}'
    patient_email = get_patient_contact_email(appointment)
    ack_message = build_booking_ack_message(appointment)

    Notification.objects.create(
        user=appointment.patient,
        notification_type='APPOINTMENT_REMINDER',
        title='Demande de rendez-vous enregistrée',
        message=ack_message[:500],
        appointment=appointment,
    )
    log_appointment_notification(
        appointment, channel='INTERNAL', notification_type='REQUEST_RECEIVED',
        recipient=appointment.patient, destination=appointment.patient.email, status='SENT',
    )

    Notification.objects.create(
        user=appointment.doctor.user,
        notification_type='GENERAL',
        title='Nouvelle postulation — rendez-vous',
        message=(
            f'{patient_name} a postulé pour votre session du {appt_label}. '
            f'Motif : {appointment.reason or "Non précisé"}. '
            f'N° suivi {ref} — ordre de passage #{appointment.queue_number or "—"}.'
        ),
        appointment=appointment,
    )

    for admin in get_hospital_staff_to_notify(appointment.hospital):
        Notification.objects.create(
            user=admin,
            notification_type='GENERAL',
            title=f'Nouvelle postulation — {appointment.hospital.name}',
            message=(
                f'{patient_name} → Dr. {doctor_name} le {appt_label}. '
                f'N° {ref}. Statut : en attente.'
            ),
            appointment=appointment,
        )

    patient_email_sent, patient_email_error = send_appointment_email(
        appointment,
        subject=f'[Isoko Hub] Demande de rendez-vous enregistrée — {ref}',
        message=ack_message,
        notification_type='REQUEST_RECEIVED',
    )

    log_audit_event(
        user=booked_by,
        user_email=getattr(booked_by, 'email', '') if booked_by else appointment.patient.email,
        user_role=getattr(booked_by, 'role', 'CUSTOMER') if booked_by else 'CUSTOMER',
        action='APPOINTMENT_BOOKED',
        resource=f'Appointment {appointment.reference_code or appointment.id}',
        request=request,
        status='SUCCESS',
        details={
            'hospital_id': str(appointment.hospital_id),
            'doctor_id': str(appointment.doctor_id),
            'slot_id': str(appointment.slot_id) if appointment.slot_id else None,
            'patient_email': patient_email,
            'patient_email_sent': patient_email_sent,
            'queue_number': appointment.queue_number,
            'reference_code': appointment.reference_code,
        },
    )
    log_appointment_event(
        appointment, 'CREATED', actor=booked_by,
        comment='Demande de rendez-vous enregistrée',
        previous_status='', new_status=appointment.status,
    )
    return {
        'patient_email': patient_email,
        'patient_email_sent': patient_email_sent,
        'patient_email_error': patient_email_error,
        'patient_acknowledgment_message': ack_message,
    }


def notify_appointment_confirmed(appointment, confirmed_by=None, request=None, previous_status='PENDING', message=''):
    appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    doctor_name = appointment.doctor.user.get_full_name()
    patient_name = get_patient_display_name(appointment)
    ref = appointment.reference_code or f'#{appointment.queue_number}'
    patient_message = (message or '').strip() or build_default_confirmation_message(appointment)
    patient_email = get_patient_contact_email(appointment)

    Notification.objects.create(
        user=appointment.patient,
        notification_type='APPOINTMENT_REMINDER',
        title='Rendez-vous confirmé',
        message=patient_message[:500],
        appointment=appointment,
    )

    patient_email_sent, patient_email_error = send_appointment_email(
        appointment,
        subject=f'[Isoko Hub] Rendez-vous confirmé — {ref}',
        message=patient_message,
        notification_type='APPOINTMENT_CONFIRMED',
    )

    doctor_user = appointment.doctor.user
    doctor_notification = (
        f'Le rendez-vous de {patient_name} du {appt_label} a été confirmé par l\'administration.\n'
        f'N° {ref} — ordre #{appointment.queue_number or "—"}.\n'
        f'Motif : {appointment.reason or "Non précisé"}.'
    )
    Notification.objects.create(
        user=doctor_user,
        notification_type='GENERAL',
        title=f'RDV confirmé — {patient_name}',
        message=doctor_notification,
        appointment=appointment,
    )
    doctor_email_sent, doctor_email_error = send_user_email(
        doctor_user,
        subject=f'[Isoko Hub] RDV confirmé — {patient_name} ({ref})',
        message=(
            f'Bonjour Dr. {doctor_name},\n\n'
            f'L\'administration a confirmé le rendez-vous suivant :\n\n'
            f'Patient : {patient_name}\n'
            f'Date du rendez-vous : {appt_label}\n'
            f'N° suivi : {ref}\n'
            f'Ordre de passage : #{appointment.queue_number or "—"}\n'
            f'Motif : {appointment.reason or "Non précisé"}\n\n'
            f'Consultez votre tableau de bord pour suivre l\'évolution en temps réel.\n'
        ),
        appointment=appointment,
        notification_type='DOCTOR_APPOINTMENT_CONFIRMED',
    )

    log_audit_event(
        user=confirmed_by,
        action='APPOINTMENT_CONFIRMED',
        resource=f'Appointment {ref}',
        request=request,
        status='SUCCESS',
        details={
            'reference_code': ref,
            'patient_email': patient_email,
            'patient_email_sent': patient_email_sent,
            'doctor_email': doctor_user.email,
            'doctor_email_sent': doctor_email_sent,
        },
    )
    log_appointment_event(
        appointment, 'CONFIRMED', actor=confirmed_by,
        comment=patient_message[:500],
        previous_status=previous_status, new_status='CONFIRMED',
    )
    return {
        'patient_email': patient_email,
        'patient_email_sent': patient_email_sent,
        'patient_email_error': patient_email_error,
        'doctor_email_sent': doctor_email_sent,
        'doctor_email_error': doctor_email_error,
    }


def notify_appointment_check_in(
    appointment,
    checked_in_by=None,
    request=None,
    orientation_notes='',
    service_name=None,
):
    """Notifie médecin, admin et patient lors de l'arrivée / orientation à l'accueil."""
    patient_name = get_patient_display_name(appointment)
    ref = appointment.reference_code or str(appointment.id)
    appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    doctor_name = appointment.doctor.user.get_full_name()
    svc = service_name or (appointment.service.name if appointment.service_id else None)
    orientation = (orientation_notes or '').strip()
    orient_line = f' Orientation : {orientation}' if orientation else ''
    service_line = f' Service : {svc}.' if svc else ''

    Notification.objects.create(
        user=appointment.patient,
        notification_type='GENERAL',
        title='Arrivée enregistrée — orientation',
        message=(
            f'Votre arrivée a été enregistrée à l\'accueil. N° {ref}.'
            f'{service_line}{orient_line}'
        ),
        appointment=appointment,
    )

    Notification.objects.create(
        user=appointment.doctor.user,
        notification_type='GENERAL',
        title=f'Patient orienté vers vous — {patient_name}',
        message=(
            f'{patient_name} est arrivé(e) et a été orienté(e) vers vous '
            f'pour le RDV du {appt_label}. '
            f'N° {ref} — ordre #{appointment.queue_number or "—"}.'
            f'{service_line}{orient_line} '
            f'Statut : {appointment.get_status_display()}.'
        ),
        appointment=appointment,
    )

    for admin in get_hospital_staff_to_notify(appointment.hospital):
        Notification.objects.create(
            user=admin,
            notification_type='GENERAL',
            title=f'Orientation patient — {patient_name}',
            message=(
                f'{patient_name} orienté(e) à l\'accueil vers Dr. {doctor_name} '
                f'({appt_label}).{service_line}{orient_line} N° {ref}.'
            ),
            appointment=appointment,
        )

    log_appointment_notification(
        appointment, channel='INTERNAL', notification_type='PATIENT_ARRIVED',
        recipient=appointment.doctor.user, destination=appointment.doctor.user.email, status='SENT',
    )

    log_audit_event(
        user=checked_in_by,
        action='APPOINTMENT_ORIENTATION',
        resource=f'Appointment {ref}',
        request=request,
        details={
            'reference_code': ref,
            'patient_name': patient_name,
            'doctor': doctor_name,
            'service': svc,
            'orientation': orientation,
            'status': appointment.status,
        },
    )


def notify_appointment_rejected(appointment, reason='', rejected_by=None, request=None, previous_status='PENDING'):
    appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    patient_name = get_patient_display_name(appointment)
    ref = appointment.reference_code or str(appointment.id)
    reason_text = reason.strip() if reason else 'Non précisé'
    patient_email = get_patient_contact_email(appointment)

    Notification.objects.create(
        user=appointment.patient,
        notification_type='GENERAL',
        title='Demande de rendez-vous refusée',
        message=(
            f'Votre demande ({ref}) du {appt_label} a été refusée. '
            f'Motif : {reason_text}.'
        ),
        appointment=appointment,
    )

    patient_email_sent, patient_email_error = send_appointment_email(
        appointment,
        subject=f'[Isoko Hub] Demande de rendez-vous refusée — {ref}',
        message=(
            f'Bonjour {patient_name},\n\n'
            f'Votre demande de rendez-vous ({ref}) pour le {appt_label} '
            f'a été refusée par {appointment.hospital.name}.\n\n'
            f'Motif : {reason_text}\n\n'
            f'Pour toute question, contactez l\'établissement.\n'
        ),
        notification_type='APPOINTMENT_REJECTED',
    )

    doctor_user = appointment.doctor.user
    doctor_name = appointment.doctor.user.get_full_name()
    Notification.objects.create(
        user=doctor_user,
        notification_type='GENERAL',
        title=f'Demande refusée — {patient_name}',
        message=(
            f'La postulation de {patient_name} ({ref}) du {appt_label} '
            f'a été refusée par l\'administration.\nMotif : {reason_text}.'
        ),
        appointment=appointment,
    )
    doctor_email_sent, doctor_email_error = send_user_email(
        doctor_user,
        subject=f'[Isoko Hub] Postulation refusée — {patient_name} ({ref})',
        message=(
            f'Bonjour Dr. {doctor_name},\n\n'
            f'L\'administration a refusé la demande de rendez-vous suivante :\n\n'
            f'Patient : {patient_name}\n'
            f'Date du rendez-vous : {appt_label}\n'
            f'N° suivi : {ref}\n'
            f'Motif du refus : {reason_text}\n'
        ),
        appointment=appointment,
        notification_type='DOCTOR_APPOINTMENT_REJECTED',
    )

    log_audit_event(
        user=rejected_by,
        action='APPOINTMENT_REJECTED',
        resource=f'Appointment {ref}',
        request=request,
        status='WARNING',
        details={
            'reason': reason_text,
            'patient_email': patient_email,
            'patient_email_sent': patient_email_sent,
            'doctor_email_sent': doctor_email_sent,
        },
    )
    log_appointment_event(
        appointment, 'REJECTED', actor=rejected_by,
        comment=reason_text,
        previous_status=previous_status, new_status='REJECTED',
    )
    return {
        'patient_email': patient_email,
        'patient_email_sent': patient_email_sent,
        'patient_email_error': patient_email_error,
        'doctor_email_sent': doctor_email_sent,
        'doctor_email_error': doctor_email_error,
    }


def notify_appointment_cancelled(appointment, reason='', cancelled_by=None, request=None):
    """Email patient quand l'hôpital annule un RDV (distinct du refus de postulation)."""
    appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    patient_name = get_patient_display_name(appointment)
    ref = appointment.reference_code or str(appointment.id)
    reason_text = (reason or '').strip() or 'Non précisé'
    patient_email = get_patient_contact_email(appointment)

    if appointment.patient_id:
        Notification.objects.create(
            user=appointment.patient,
            notification_type='GENERAL',
            title='Rendez-vous annulé',
            message=(
                f'Votre rendez-vous ({ref}) du {appt_label} a été annulé. '
                f'Motif : {reason_text}.'
            ),
            appointment=appointment,
        )

    patient_email_sent, patient_email_error = send_appointment_email(
        appointment,
        subject=f'[Isoko Hub] Rendez-vous annulé — {ref}',
        message=(
            f'Bonjour {patient_name},\n\n'
            f'Votre rendez-vous ({ref}) prévu le {appt_label} '
            f'a été annulé par {appointment.hospital.name}.\n\n'
            f'Motif : {reason_text}\n\n'
            f'Pour toute question, contactez l\'établissement.\n'
            f'\n— Isoko Hub\n'
        ),
        notification_type='APPOINTMENT_CANCELLED',
    )
    log_appointment_event(
        appointment, 'CANCELLED_NOTIFIED', actor=cancelled_by,
        comment=reason_text,
        previous_status=appointment.status, new_status=appointment.status,
    )
    return {
        'patient_email': patient_email,
        'patient_email_sent': patient_email_sent,
        'patient_email_error': patient_email_error,
    }


def notify_appointment_refunded(appointment, note='', actor=None):
    """Email patient après remboursement de la consultation."""
    appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    patient_name = get_patient_display_name(appointment)
    ref = appointment.reference_code or str(appointment.id)
    amount = appointment.consultation_fee_amount or 0
    currency = appointment.consultation_fee_currency or 'BIF'
    note_text = (note or '').strip()

    patient_email_sent, patient_email_error = send_appointment_email(
        appointment,
        subject=f'[Isoko Hub] Remboursement consultation — {ref}',
        message=(
            f'Bonjour {patient_name},\n\n'
            f'Le paiement de votre consultation ({ref}) du {appt_label} '
            f'auprès de {appointment.hospital.name} a été remboursé.\n\n'
            f'Montant : {amount} {currency}\n'
            + (f'Détail : {note_text}\n' if note_text else '')
            + '\nSi le crédit n\'apparaît pas sous peu sur votre compte mobile money, '
            f'contactez l\'établissement.\n'
            f'\n— Isoko Hub\n'
        ),
        notification_type='APPOINTMENT_REFUNDED',
    )
    return {
        'patient_email_sent': patient_email_sent,
        'patient_email_error': patient_email_error,
    }


def notify_appointment_rescheduled(old_appointment, new_appointment, reason='', actor=None):
    """Email patient après reprogrammation (ancien RDV → nouveau)."""
    old_label = old_appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    new_label = new_appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
    patient_name = get_patient_display_name(old_appointment)
    ref = old_appointment.reference_code or str(old_appointment.id)
    reason_text = (reason or '').strip() or 'Non précisé'

    # Utiliser l'ancien RDV pour l'email (champs contact patient déjà renseignés)
    patient_email_sent, patient_email_error = send_appointment_email(
        old_appointment,
        subject=f'[Isoko Hub] Rendez-vous reprogrammé — {ref}',
        message=(
            f'Bonjour {patient_name},\n\n'
            f'Votre rendez-vous ({ref}) a été reprogrammé par {old_appointment.hospital.name}.\n\n'
            f'Ancien créneau : {old_label}\n'
            f'Nouveau créneau : {new_label}\n'
            f'Motif : {reason_text}\n\n'
            f'Le nouveau rendez-vous est en attente de confirmation si nécessaire.\n'
            f'\n— Isoko Hub\n'
        ),
        notification_type='APPOINTMENT_RESCHEDULED',
    )
    return {
        'patient_email_sent': patient_email_sent,
        'patient_email_error': patient_email_error,
    }


def notify_anticipation_response(appointment, *, accepted, previous_date=None, note='', actor=None):
    """Email patient après acceptation ou refus d'une demande d'anticipation / report."""
    ref = appointment.reference_code or str(appointment.id)
    patient_name = get_patient_display_name(appointment)
    note_text = (note or '').strip()
    if accepted:
        prev = previous_date or appointment.appointment_date
        old_label = prev.strftime('%d/%m/%Y à %H:%M')
        new_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
        move_kind = 'anticipé' if appointment.appointment_date < prev else 'reporté'
        subject = f'[Isoko Hub] Déplacement de rendez-vous accepté — {ref}'
        message = (
            f'Bonjour {patient_name},\n\n'
            f'Votre demande de déplacement pour le rendez-vous ({ref}) a été acceptée '
            f'par {appointment.hospital.name}.\n\n'
            f'Ancien créneau : {old_label}\n'
            f'Nouveau créneau : {new_label}\n'
            f'Le rendez-vous a été {move_kind}.\n'
            + (f'Note de l\'établissement : {note_text}\n' if note_text else '')
            + '\n— Isoko Hub\n'
        )
        notif_type = 'ANTICIPATION_ACCEPTED'
    else:
        appt_label = appointment.appointment_date.strftime('%d/%m/%Y à %H:%M')
        subject = f'[Isoko Hub] Déplacement de rendez-vous refusé — {ref}'
        message = (
            f'Bonjour {patient_name},\n\n'
            f'Votre demande de déplacement pour le rendez-vous ({ref}) du {appt_label} '
            f'a été refusée par {appointment.hospital.name}.\n\n'
            f'Le créneau initial est maintenu.\n'
            + (f'Motif : {note_text}\n' if note_text else '')
            + '\n— Isoko Hub\n'
        )
        notif_type = 'ANTICIPATION_REFUSED'

    patient_email_sent, patient_email_error = send_appointment_email(
        appointment,
        subject=subject,
        message=message,
        notification_type=notif_type,
    )
    return {
        'patient_email_sent': patient_email_sent,
        'patient_email_error': patient_email_error,
    }


def log_slot_action(action, slot, user, request=None, details=None):
    log_audit_event(
        user=user,
        action=action,
        resource=f'AppointmentSlot #{slot.id} — {slot.title}',
        request=request,
        details={
            'hospital_id': str(slot.hospital_id),
            'doctor_id': str(slot.doctor_id),
            'slot_date': str(slot.slot_date),
            'is_active': slot.is_active,
            **(details or {}),
        },
    )


def generate_monthly_slots(*, hospital, doctor, year, month, service=None, max_patients=10,
                           consultation_type='IN_PERSON', created_by=None, publish=False):
    """
    Génère des créneaux à partir des horaires hebdomadaires (DoctorSchedule)
    pour chaque jour du mois. Par défaut non publiés (is_active=False).
    """
    schedules = DoctorSchedule.objects.filter(
        hospital=hospital, doctor=doctor, is_available=True
    )
    if not schedules.exists():
        return [], 'Aucun horaire hebdomadaire configuré pour ce médecin.'

    schedule_by_day = {s.day_of_week: s for s in schedules}
    days_in_month = calendar.monthrange(year, month)[1]
    created = []
    skipped = 0

    for day in range(1, days_in_month + 1):
        current = date(year, month, day)
        if current < timezone.now().date():
            skipped += 1
            continue
        weekday = current.weekday()  # 0=Lundi
        sched = schedule_by_day.get(weekday)
        if not sched:
            continue
        if AppointmentSlot.objects.filter(
            hospital=hospital, doctor=doctor, slot_date=current,
            start_time=sched.start_time,
        ).exists():
            skipped += 1
            continue
        slot = AppointmentSlot.objects.create(
            hospital=hospital,
            doctor=doctor,
            service=service,
            title=f'Consultation — {doctor.user.get_full_name()}',
            slot_date=current,
            start_time=sched.start_time,
            end_time=sched.end_time,
            consultation_type=consultation_type,
            max_patients=max_patients,
            status='OPEN',
            is_active=publish,
            created_by=created_by,
        )
        created.append(slot)

    return created, f'{len(created)} créneau(x) créé(s), {skipped} ignoré(s).'


def generate_monthly_slots_for_hospital(
    *,
    hospital,
    year,
    month,
    max_patients=10,
    consultation_type='IN_PERSON',
    created_by=None,
    publish=False,
    doctor_ids=None,
):
    """
    Génère le planning mensuel pour tous les médecins (ou une liste)
    ayant des horaires hebdomadaires. Service = premier service lié au médecin.
    """
    doctors_qs = DoctorProfile.objects.filter(hospital=hospital, is_active=True)
    if doctor_ids:
        doctors_qs = doctors_qs.filter(id__in=doctor_ids)

    results = []
    total_created = 0
    skipped_doctors = []

    for doctor in doctors_qs.select_related('user'):
        service = doctor.related_services_queryset().first()
        if not service:
            skipped_doctors.append({
                'doctor_id': str(doctor.id),
                'doctor_name': doctor.user.get_full_name(),
                'reason': 'Aucun service associé',
            })
            continue
        if not DoctorSchedule.objects.filter(
            hospital=hospital, doctor=doctor, is_available=True
        ).exists():
            skipped_doctors.append({
                'doctor_id': str(doctor.id),
                'doctor_name': doctor.user.get_full_name(),
                'reason': 'Aucun horaire hebdomadaire',
            })
            continue

        created, message = generate_monthly_slots(
            hospital=hospital,
            doctor=doctor,
            year=year,
            month=month,
            service=service,
            max_patients=max_patients,
            consultation_type=consultation_type,
            created_by=created_by,
            publish=publish,
        )
        total_created += len(created)
        results.append({
            'doctor_id': str(doctor.id),
            'doctor_name': doctor.user.get_full_name(),
            'service_id': str(service.id),
            'service_name': service.name,
            'created_count': len(created),
            'message': message,
        })

    summary = (
        f'{total_created} créneau(x) créé(s) pour {len(results)} médecin(s).'
        + (f' {len(skipped_doctors)} médecin(s) ignoré(s).' if skipped_doctors else '')
    )
    return {
        'message': summary,
        'created_count': total_created,
        'doctors': results,
        'skipped': skipped_doctors,
    }
