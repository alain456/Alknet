"""Horaires médecins dynamiques.

Quand l'heure de fin d'un créneau est dépassée (heure de Bujumbura), le créneau
se ferme et la même plage reprend à la prochaine occurrence du jour, avec une
capacité remise à zéro. L'admin est signalé s'il n'y a aucun créneau à venir
ou aucun rendez-vous sur le prochain créneau publié.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Q

from accounts.services import log_audit_event

from .models import AppointmentSlot, DoctorProfile, DoctorSchedule

HOSPITAL_TZ = ZoneInfo('Africa/Bujumbura')
ACTIVE_SLOT_STATUSES = ('OPEN', 'FULL')


def hospital_now():
    from django.utils import timezone
    return timezone.now().astimezone(HOSPITAL_TZ)


def slot_end_at(slot_date, end_time):
    return datetime.combine(slot_date, end_time, tzinfo=HOSPITAL_TZ)


def _doctor_name(doctor):
    user = getattr(doctor, 'user', None)
    if user is None:
        return 'Médecin'
    full = (user.get_full_name() or '').strip()
    return full or user.email or 'Médecin'


def _clinical_doctors(hospital):
    return (
        DoctorProfile.objects.filter(hospital=hospital, is_active=True)
        .exclude(Q(staff_category='NURSE') | Q(staff_category='ACCOUNTANT') | Q(professional_title='INFIRMIER'))
        .select_related('user')
    )


def schedule_end_at(schedule, on_date=None):
    """Instant de fin : date du créneau + heure de fin, ou le lendemain si la fin est avant le début."""
    start_date = on_date or schedule.schedule_date
    if start_date is None or not schedule.end_time:
        return None
    end_date = start_date
    if schedule.start_time and schedule.end_time <= schedule.start_time:
        end_date = start_date + timedelta(days=1)
    return slot_end_at(end_date, schedule.end_time)


def roll_elapsed_schedule_dates(hospital, now):
    """Avance la date du créneau d'une semaine quand son heure de fin est dépassée."""
    updated = []
    for schedule in DoctorSchedule.objects.filter(hospital=hospital, schedule_date__isnull=False):
        end_at = schedule_end_at(schedule)
        if end_at is None or end_at > now:
            continue
        next_date = schedule.schedule_date
        while True:
            next_date = next_date + timedelta(days=7)
            if schedule_end_at(schedule, on_date=next_date) > now:
                break
        schedule.schedule_date = next_date
        schedule.day_of_week = next_date.weekday()
        schedule.save(update_fields=['schedule_date', 'day_of_week'])
        updated.append(schedule)
    return updated


def _next_occurrence_date(day_of_week, end_time, now):
    """Prochaine date où la plage n'est pas encore terminée."""
    candidate = now.date()
    delta = (day_of_week - candidate.weekday()) % 7
    candidate = candidate + timedelta(days=delta)
    if slot_end_at(candidate, end_time) <= now:
        candidate = candidate + timedelta(days=7)
    return candidate


def roll_expired_slots(hospital, now=None):
    """
    Ferme les créneaux dont l'heure de fin est passée et ouvre la prochaine
    occurrence hebdomadaire si elle n'existe pas encore.
    """
    now = now or hospital_now()
    rolled = []

    with transaction.atomic():
        roll_elapsed_schedule_dates(hospital, now)
        expired = list(
            AppointmentSlot.objects.filter(
                hospital=hospital,
                status__in=ACTIVE_SLOT_STATUSES,
                slot_date__lte=now.date(),
            ).select_related('doctor', 'service')
        )
        to_close = [
            slot for slot in expired
            if slot_end_at(slot.slot_date, slot.end_time) <= now
        ]
        if not to_close:
            return rolled

        future = list(
            AppointmentSlot.objects.filter(
                hospital=hospital,
                status__in=ACTIVE_SLOT_STATUSES,
                slot_date__gte=now.date(),
            )
        )
        future_keys = {
            (slot.doctor_id, slot.slot_date, slot.start_time)
            for slot in future
            if slot_end_at(slot.slot_date, slot.end_time) > now
        }
        future_weekdays = {
            (slot.doctor_id, slot.slot_date.weekday())
            for slot in future
            if slot_end_at(slot.slot_date, slot.end_time) > now
        }

        schedules = {
            (item.doctor_id, item.day_of_week): item
            for item in DoctorSchedule.objects.filter(
                hospital=hospital, is_available=True,
            )
        }

        for slot in to_close:
            slot.status = 'CLOSED'
            slot.save(update_fields=['status', 'updated_at'])

            weekday = slot.slot_date.weekday()
            schedule = schedules.get((slot.doctor_id, weekday))
            if schedule is None:
                continue
            if (slot.doctor_id, weekday) in future_weekdays:
                continue

            next_date = _next_occurrence_date(weekday, schedule.end_time, now)
            key = (slot.doctor_id, next_date, schedule.start_time)
            if key in future_keys:
                future_weekdays.add((slot.doctor_id, weekday))
                continue
            if AppointmentSlot.objects.filter(
                hospital=hospital,
                doctor_id=slot.doctor_id,
                slot_date=next_date,
                start_time=schedule.start_time,
            ).exclude(status='CANCELLED').exists():
                future_weekdays.add((slot.doctor_id, weekday))
                continue

            created = AppointmentSlot.objects.create(
                hospital=hospital,
                doctor_id=slot.doctor_id,
                service=slot.service,
                title=slot.title,
                slot_date=next_date,
                start_time=schedule.start_time,
                end_time=schedule.end_time,
                consultation_type=slot.consultation_type,
                max_patients=slot.max_patients,
                status='OPEN',
                is_active=slot.is_active,
                notes=slot.notes,
                created_by=slot.created_by,
            )
            future_keys.add(key)
            future_weekdays.add((slot.doctor_id, weekday))
            rolled.append(created)

    if rolled:
        log_audit_event(
            action='APPOINTMENT_SLOT_ROLLED',
            resource=f'Planning dynamique — {hospital.name}',
            details={
                'hospital_id': str(hospital.id),
                'rolled_count': len(rolled),
                'slot_ids': [str(slot.id) for slot in rolled],
            },
        )
    return rolled


def planning_alert_payload(hospital, now=None):
    """Ferme les créneaux dépassés, puis liste les manques à signaler à l'admin."""
    now = now or hospital_now()
    rolled = roll_expired_slots(hospital, now=now)

    missing_slots = []
    missing_appointments = []

    schedules = list(
        DoctorSchedule.objects.filter(hospital=hospital, is_available=True)
        .select_related('doctor', 'doctor__user')
    )
    schedules_by_doctor = {}
    for item in schedules:
        schedules_by_doctor.setdefault(item.doctor_id, []).append(item)

    future_slots = [
        slot for slot in AppointmentSlot.objects.filter(
            hospital=hospital,
            status__in=ACTIVE_SLOT_STATUSES,
            slot_date__gte=now.date(),
        ).select_related('doctor', 'doctor__user')
        if slot_end_at(slot.slot_date, slot.end_time) > now
    ]
    future_by_doctor = {}
    for slot in future_slots:
        future_by_doctor.setdefault(slot.doctor_id, []).append(slot)
    for slots in future_by_doctor.values():
        slots.sort(key=lambda slot: (slot.slot_date, slot.start_time))

    for doctor in _clinical_doctors(hospital):
        name = _doctor_name(doctor)
        upcoming = future_by_doctor.get(doctor.id, [])
        has_hours = bool(schedules_by_doctor.get(doctor.id))
        if has_hours:
            continue
        if not upcoming:
            missing_slots.append({
                'doctor_id': str(doctor.id),
                'doctor_name': name,
                'reason': 'Aucun horaire configuré',
            })
            continue

        published = [slot for slot in upcoming if slot.is_active]
        target = published[0] if published else upcoming[0]
        if target.booked_count == 0:
            missing_appointments.append({
                'doctor_id': str(doctor.id),
                'doctor_name': name,
                'slot_id': str(target.id),
                'slot_date': target.slot_date.isoformat(),
                'day_of_week': target.slot_date.weekday(),
                'start_time': target.start_time.strftime('%H:%M'),
                'end_time': target.end_time.strftime('%H:%M'),
                'is_published': target.is_active,
                'reason': (
                    'Aucun rendez-vous sur le prochain créneau'
                    if target.is_active
                    else 'Aucun rendez-vous — créneau non publié'
                ),
            })

    windows = []
    for schedule in schedules:
        if (
            not schedule.doctor.is_active
            or schedule.doctor.staff_category in ('NURSE', 'ACCOUNTANT')
            or schedule.doctor.professional_title == 'INFIRMIER'
        ):
            continue
        if schedule.schedule_date:
            next_date = schedule.schedule_date
            start_at = datetime.combine(next_date, schedule.start_time, tzinfo=HOSPITAL_TZ)
            end_at = schedule_end_at(schedule, on_date=next_date)
        else:
            next_date = _next_occurrence_date(schedule.day_of_week, schedule.end_time, now)
            start_at = datetime.combine(next_date, schedule.start_time, tzinfo=HOSPITAL_TZ)
            end_date = next_date
            if schedule.end_time <= schedule.start_time:
                end_date = next_date + timedelta(days=1)
            end_at = slot_end_at(end_date, schedule.end_time)
        if start_at <= now < end_at:
            window_status = 'in_progress'
        elif now < start_at:
            window_status = 'upcoming'
        else:
            window_status = 'elapsed'
        matching = [
            slot for slot in future_by_doctor.get(schedule.doctor_id, [])
            if slot.slot_date == next_date
        ]
        slot = matching[0] if matching else None
        windows.append({
            'schedule_id': str(schedule.id),
            'doctor_id': str(schedule.doctor_id),
            'doctor_name': _doctor_name(schedule.doctor),
            'day_of_week': schedule.day_of_week,
            'window_status': window_status,
            'next_date': next_date.isoformat(),
            'start_time': schedule.start_time.strftime('%H:%M'),
            'end_time': schedule.end_time.strftime('%H:%M'),
            'has_slot': slot is not None,
            'slot_id': str(slot.id) if slot else None,
            'is_published': bool(slot and slot.is_active),
            'appointment_count': slot.booked_count if slot else 0,
        })

    for window in windows:
        if not window['has_slot']:
            missing_slots.append({
                'doctor_id': window['doctor_id'],
                'doctor_name': window['doctor_name'],
                'day_of_week': window['day_of_week'],
                'next_date': window['next_date'],
                'reason': 'Aucun créneau programmé',
            })
        elif window['appointment_count'] == 0:
            missing_appointments.append({
                'doctor_id': window['doctor_id'],
                'doctor_name': window['doctor_name'],
                'slot_id': window['slot_id'],
                'slot_date': window['next_date'],
                'day_of_week': window['day_of_week'],
                'start_time': window['start_time'],
                'end_time': window['end_time'],
                'is_published': window['is_published'],
                'reason': (
                    'Aucun rendez-vous sur le prochain créneau'
                    if window['is_published']
                    else 'Aucun rendez-vous — créneau non publié'
                ),
            })

    alert_count = len(missing_slots) + len(missing_appointments)
    return {
        'server_now': now.isoformat(),
        'timezone': 'Africa/Bujumbura',
        'rolled_count': len(rolled),
        'alert_count': alert_count,
        'missing_slots': missing_slots,
        'missing_appointments': missing_appointments,
        'windows': windows,
    }
