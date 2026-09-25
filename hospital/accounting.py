"""Comptabilité hôpital : factures, rapprochement des paiements, clôture du jour."""
import csv
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Exists, OuterRef, Sum
from django.http import HttpResponse
from django.utils import timezone

from .appointment_payment import mark_appointment_paid_by_staff
from .appointment_workflow import get_hospital_code
from .models import Appointment, HospitalCashClosing, Invoice
from .schedule_dynamics import HOSPITAL_TZ, hospital_now

METHOD_LABELS = {
    'CASH': 'Espèces',
    'BURUNDIPAY': 'BurundiPay',
    'FREE': 'Gratuit',
    'OTHER': 'Autre',
    '': 'Non précisé',
}
ACT_LABELS = {
    'CONSULTATION': 'Consultations',
    'EXAM': 'Examens',
    'OTHER': 'Autres prestations',
}


def _money(value):
    return float(value or 0)


def _day_bounds(day):
    start = datetime.combine(day, time.min, tzinfo=HOSPITAL_TZ)
    return start, start + timedelta(days=1)


def _patient_name(appointment=None, patient=None):
    if appointment is not None:
        contact = (appointment.patient_contact_name or '').strip()
        if contact:
            return contact
        patient = appointment.patient
    if patient is None:
        return 'Patient'
    full = (patient.get_full_name() or '').strip()
    return full or patient.email or 'Patient'


def allocate_invoice_number(hospital):
    code = get_hospital_code(hospital)
    year = hospital_now().year
    prefix = f'FAC-{code}-{year}-'
    taken = set(
        Invoice.objects.filter(invoice_number__startswith=prefix).values_list('invoice_number', flat=True)
    )
    seq = len(taken) + 1
    number = f'{prefix}{seq:06d}'
    while number in taken or Invoice.objects.filter(invoice_number=number).exists():
        seq += 1
        number = f'{prefix}{seq:06d}'
    return number


def day_is_closed(hospital, day):
    return HospitalCashClosing.objects.filter(hospital=hospital, period_date=day).exists()


def _invoice_brief(invoice):
    return {
        'id': str(invoice.id),
        'invoice_number': invoice.invoice_number or '',
        'patient_name': _patient_name(invoice.appointment, invoice.patient),
        'amount': _money(invoice.amount),
        'currency': invoice.currency or 'BIF',
        'status': invoice.status,
        'payment_method': invoice.payment_method or '',
        'payment_method_label': METHOD_LABELS.get(invoice.payment_method or '', invoice.payment_method or '—'),
        'act_type': invoice.act_type,
        'act_label': invoice.act_label or invoice.get_act_type_display(),
        'description': invoice.description or '',
        'issued_at': invoice.issued_at.isoformat() if invoice.issued_at else None,
        'paid_at': invoice.paid_at.isoformat() if invoice.paid_at else None,
        'appointment': str(invoice.appointment_id) if invoice.appointment_id else None,
        'appointment_reference': (
            invoice.appointment.reference_code if invoice.appointment_id and invoice.appointment else ''
        ),
    }


def _appointment_brief(appointment):
    service = appointment.service.name if appointment.service_id and appointment.service else ''
    return {
        'id': str(appointment.id),
        'reference_code': appointment.reference_code or '',
        'patient_id': str(appointment.patient_id),
        'patient_name': _patient_name(appointment),
        'amount': int(appointment.consultation_fee_amount or 0),
        'currency': appointment.consultation_fee_currency or 'BIF',
        'payment_status': appointment.payment_status,
        'payment_method': appointment.payment_method or '',
        'payment_method_label': METHOD_LABELS.get(appointment.payment_method or '', appointment.payment_method or '—'),
        'paid_at': appointment.paid_at.isoformat() if appointment.paid_at else None,
        'service_name': service or 'Consultation',
        'appointment_date': appointment.appointment_date.isoformat() if appointment.appointment_date else None,
    }


def paid_invoices_between(hospital, start, end):
    return Invoice.objects.filter(
        hospital=hospital,
        status='PAID',
        paid_at__gte=start,
        paid_at__lt=end,
    )


def build_desk(hospital, day):
    start, end = _day_bounds(day)
    month_start = datetime.combine(day.replace(day=1), time.min, tzinfo=HOSPITAL_TZ)
    if day.month == 12:
        month_end = datetime.combine(day.replace(year=day.year + 1, month=1, day=1), time.min, tzinfo=HOSPITAL_TZ)
    else:
        month_end = datetime.combine(day.replace(month=day.month + 1, day=1), time.min, tzinfo=HOSPITAL_TZ)

    collected_qs = paid_invoices_between(hospital, start, end).select_related('patient', 'appointment')
    collected_total = collected_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    by_method = []
    for code, label in METHOD_LABELS.items():
        subset = collected_qs.filter(payment_method=code)
        count = subset.count()
        if count == 0 and code == '':
            continue
        amount = subset.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        if count == 0 and amount == 0 and code not in ('CASH', 'BURUNDIPAY', 'FREE'):
            continue
        by_method.append({
            'method': code or 'UNSPECIFIED',
            'label': label,
            'amount': _money(amount),
            'count': count,
        })

    pending_qs = Invoice.objects.filter(hospital=hospital, status='PENDING').select_related('patient', 'appointment')
    pending_total = pending_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')

    has_invoice = Invoice.objects.filter(appointment_id=OuterRef('pk')).exclude(status='CANCELLED')
    paid_without = (
        Appointment.objects.filter(
            hospital=hospital,
            payment_status__in=('PAID', 'WAIVED'),
            paid_at__gte=start,
            paid_at__lt=end,
        )
        .exclude(Exists(has_invoice))
        .select_related('patient', 'service')
        .order_by('paid_at')
    )
    to_collect = (
        Appointment.objects.filter(
            hospital=hospital,
            appointment_date__gte=start,
            appointment_date__lt=end,
            payment_status__in=('UNPAID', 'FAILED', 'AWAITING_PIN'),
            consultation_fee_amount__gt=0,
        )
        .exclude(status__in=('CANCELLED', 'REJECTED', 'NO_SHOW'))
        .exclude(Exists(has_invoice))
        .select_related('patient', 'service')
        .order_by('appointment_date')
    )

    month_paid = paid_invoices_between(hospital, month_start, month_end)
    month_total = month_paid.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    by_act = []
    for code, label in ACT_LABELS.items():
        subset = month_paid.filter(act_type=code)
        count = subset.count()
        amount = subset.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        if count == 0:
            continue
        by_act.append({
            'act': code,
            'label': label,
            'amount': _money(amount),
            'count': count,
        })

    unpaid = [
        _invoice_brief(inv)
        for inv in pending_qs.order_by('issued_at')[:100]
    ]
    closing = HospitalCashClosing.objects.filter(hospital=hospital, period_date=day).select_related('closed_by').first()
    recent = HospitalCashClosing.objects.filter(hospital=hospital).select_related('closed_by')[:12]
    patients = []
    seen = set()
    recent_appts = (
        Appointment.objects.filter(hospital=hospital)
        .select_related('patient')
        .order_by('-created_at')[:40]
    )
    for appt in recent_appts:
        if appt.patient_id in seen:
            continue
        seen.add(appt.patient_id)
        patients.append({'id': str(appt.patient_id), 'name': _patient_name(appt)})

    return {
        'date': day.isoformat(),
        'closed': closing is not None,
        'closing': _closing_brief(closing) if closing else None,
        'patients': patients,
        'day': {
            'collected': _money(collected_total),
            'pending': _money(pending_total),
            'by_method': by_method,
            'paid_without_invoice': [_appointment_brief(appt) for appt in paid_without],
            'to_collect': [_appointment_brief(appt) for appt in to_collect],
            'open_invoices': unpaid[:30],
        },
        'month': {
            'label': day.strftime('%m/%Y'),
            'collected': _money(month_total),
            'by_act': by_act,
            'unpaid': unpaid,
        },
        'recent_closings': [_closing_brief(item) for item in recent],
    }


def _closing_brief(closing):
    if closing is None:
        return None
    closed_by = ''
    if closing.closed_by_id and closing.closed_by:
        closed_by = (closing.closed_by.get_full_name() or '').strip() or closing.closed_by.email
    return {
        'id': str(closing.id),
        'period_date': closing.period_date.isoformat(),
        'total_collected': _money(closing.total_collected),
        'total_pending': _money(closing.total_pending),
        'breakdown': closing.breakdown or {},
        'notes': closing.notes or '',
        'closed_at': closing.closed_at.isoformat() if closing.closed_at else None,
        'closed_by_name': closed_by,
    }


@transaction.atomic
def close_day(hospital, user, day, notes=''):
    if day_is_closed(hospital, day):
        raise ValueError('Cette journée est déjà clôturée.')
    desk = build_desk(hospital, day)
    closing = HospitalCashClosing.objects.create(
        hospital=hospital,
        period_date=day,
        total_collected=Decimal(str(desk['day']['collected'])),
        total_pending=Decimal(str(desk['day']['pending'])),
        breakdown={
            'by_method': desk['day']['by_method'],
            'by_act_month': desk['month']['by_act'],
            'paid_without_invoice': len(desk['day']['paid_without_invoice']),
            'open_invoices': len(desk['day']['open_invoices']),
        },
        notes=(notes or '').strip(),
        closed_by=user,
        closed_at=timezone.now(),
    )
    return _closing_brief(closing)


@transaction.atomic
def create_invoice_for_appointment(appointment, user, method=None):
    existing = (
        Invoice.objects.filter(appointment=appointment)
        .exclude(status='CANCELLED')
        .first()
    )
    if existing:
        return existing

    hospital = appointment.hospital
    today = hospital_now().date()
    if day_is_closed(hospital, today):
        raise ValueError('Cette journée est déjà clôturée.')

    requested = (method or '').upper()
    if appointment.payment_status in ('UNPAID', 'FAILED', 'AWAITING_PIN'):
        mark_appointment_paid_by_staff(
            appointment,
            method=requested or 'CASH',
            note='Encaissé à la comptabilité',
            actor=user,
        )
        appointment.refresh_from_db()

    if appointment.paid_at:
        paid_day = appointment.paid_at.astimezone(HOSPITAL_TZ).date()
        if day_is_closed(hospital, paid_day):
            raise ValueError('La journée de ce paiement est déjà clôturée.')

    pay_method = (appointment.payment_method or requested or 'CASH').upper()
    if pay_method == 'WAIVED':
        pay_method = 'FREE'
    if pay_method not in METHOD_LABELS or pay_method == '':
        pay_method = 'OTHER' if pay_method else 'CASH'
    if appointment.payment_status == 'WAIVED':
        pay_method = 'FREE'

    service_name = ''
    if appointment.service_id and appointment.service:
        service_name = appointment.service.name
    amount = Decimal(int(appointment.consultation_fee_amount or 0))
    status = 'PAID' if appointment.payment_status in ('PAID', 'WAIVED') else 'PENDING'
    if pay_method == 'FREE':
        status = 'PAID'
    return Invoice.objects.create(
        hospital=hospital,
        patient=appointment.patient,
        appointment=appointment,
        recorded_by=user,
        invoice_number=allocate_invoice_number(hospital),
        amount=amount,
        currency=appointment.consultation_fee_currency or 'BIF',
        description=service_name or 'Consultation',
        act_type='CONSULTATION',
        act_label=service_name or 'Consultation',
        status=status,
        payment_method=pay_method if status == 'PAID' else '',
        paid_at=appointment.paid_at if status == 'PAID' else None,
    )


def export_invoices_csv(hospital, day, scope='day'):
    if scope == 'month':
        start = datetime.combine(day.replace(day=1), time.min, tzinfo=HOSPITAL_TZ)
        if day.month == 12:
            end = datetime.combine(day.replace(year=day.year + 1, month=1, day=1), time.min, tzinfo=HOSPITAL_TZ)
        else:
            end = datetime.combine(day.replace(month=day.month + 1, day=1), time.min, tzinfo=HOSPITAL_TZ)
        filename = f'comptabilite-{day.strftime("%Y-%m")}.csv'
    else:
        start, end = _day_bounds(day)
        filename = f'comptabilite-{day.isoformat()}.csv'

    invoices = (
        Invoice.objects.filter(hospital=hospital, issued_at__gte=start, issued_at__lt=end)
        .select_related('patient', 'appointment')
        .order_by('issued_at')
    )
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow(['Numéro', 'Date', 'Patient', 'Acte', 'Mode', 'Montant', 'Devise', 'Statut'])
    for inv in invoices:
        when = inv.paid_at or inv.issued_at
        local = when.astimezone(HOSPITAL_TZ).strftime('%Y-%m-%d %H:%M') if when else ''
        writer.writerow([
            inv.invoice_number or str(inv.id),
            local,
            _patient_name(inv.appointment, inv.patient),
            inv.act_label or inv.get_act_type_display(),
            METHOD_LABELS.get(inv.payment_method or '', inv.payment_method or ''),
            f'{inv.amount:.2f}',
            inv.currency or 'BIF',
            inv.get_status_display(),
        ])
    return response
