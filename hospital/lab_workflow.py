"""Workflow laboratoire hôpital — P0–P3 (demande, validation, facture, FHIR)."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count

from django.utils import timezone

from .models import HospitalExam, Invoice, LabResult, LabResultEvent, Prescription


LAB_TRANSITIONS = {
    'REQUESTED': {'SAMPLE_COLLECTED'},
    'SAMPLE_COLLECTED': {'IN_ANALYSIS'},
    'IN_ANALYSIS': {'RESULT_AVAILABLE'},
    'RESULT_AVAILABLE': {'VALIDATED'},
    'VALIDATED': {'COMMUNICATED'},
    'COMMUNICATED': set(),
}

TECH_STATUSES = {'SAMPLE_COLLECTED', 'IN_ANALYSIS', 'RESULT_AVAILABLE', 'COMMUNICATED'}
VALIDATOR_STATUSES = {'VALIDATED'}


def log_lab_event(lab_result, actor, action, from_status='', to_status='', note='', details=None):
    return LabResultEvent.objects.create(
        lab_result=lab_result,
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        action=action,
        from_status=from_status or '',
        to_status=to_status or '',
        note=(note or '')[:500],
        details=details or {},
    )


def create_lab_from_prescription(prescription, *, hospital_exam=None, appointment=None, actor=None):
    """P0 — prescription EXAM → demande labo REQUESTED."""
    if prescription.prescription_type != 'EXAM':
        return None
    existing = LabResult.objects.filter(prescription=prescription).first()
    if existing:
        return existing

    exam = hospital_exam
    if exam is None and getattr(prescription, 'hospital_exam_id', None):
        exam = prescription.hospital_exam

    test_name = (prescription.exam_name or '').strip()
    if exam and not test_name:
        test_name = exam.name
    if not test_name:
        test_name = 'Examen prescrit'

    notes = (prescription.exam_reason or '').strip()
    if prescription.instructions:
        notes = f'{notes}\n{prescription.instructions}'.strip() if notes else prescription.instructions

    apt = appointment
    if apt is None and getattr(prescription, 'appointment_id', None):
        apt = prescription.appointment

    lab = LabResult(
        patient=prescription.patient,
        hospital=prescription.hospital,
        appointment=apt,
        prescription=prescription,
        hospital_exam=exam,
        ordered_by=prescription.doctor,
        uploaded_by=actor,
        test_name=test_name[:200],
        test_date=timezone.localdate(),
        result_value='En attente',
        result_notes=notes[:2000] if notes else '',
        status='REQUESTED',
        fhir_resource_type='ServiceRequest',
    )
    lab.save()
    log_lab_event(
        lab, actor, 'CREATED_FROM_PRESCRIPTION',
        to_status='REQUESTED',
        note=f'Prescription {prescription.id}',
        details={'prescription_id': str(prescription.id), 'exam_id': str(exam.id) if exam else None},
    )
    return lab


def ensure_exam_invoice(lab_result, actor=None):
    """P2 — facture PENDING à la validation (tarif catalogue si dispo)."""
    if lab_result.invoice_id:
        return lab_result.invoice
    exam = lab_result.hospital_exam
    amount = Decimal('0')
    currency = 'BIF'
    label = lab_result.test_name
    if exam:
        amount = Decimal(exam.price or 0)
        currency = exam.currency or 'BIF'
        label = exam.name or label
    if amount <= 0:
        return None

    from .accounting import allocate_invoice_number

    invoice = Invoice.objects.create(
        hospital=lab_result.hospital,
        patient=lab_result.patient,
        appointment=lab_result.appointment,
        recorded_by=actor if getattr(actor, 'is_authenticated', False) else None,
        invoice_number=allocate_invoice_number(lab_result.hospital),
        amount=amount,
        currency=currency,
        description=f'Examen laboratoire : {label}',
        act_type='EXAM',
        act_label=label[:200],
        status='PENDING',
    )
    lab_result.invoice = invoice
    lab_result.save(update_fields=['invoice', 'updated_at'])
    log_lab_event(
        lab_result, actor, 'INVOICE_CREATED',
        note=invoice.invoice_number or str(invoice.id),
        details={'invoice_id': str(invoice.id), 'amount': str(amount)},
    )
    return invoice


def lab_stats(hospital, days=30):
    """P2 — volumes, file d'attente, délai moyen Demandé→Validé."""
    since = timezone.now() - timedelta(days=days)
    qs = LabResult.objects.filter(hospital=hospital)
    recent = qs.filter(created_at__gte=since)

    pending = qs.filter(status__in=('REQUESTED', 'SAMPLE_COLLECTED', 'IN_ANALYSIS', 'RESULT_AVAILABLE')).count()
    validated = recent.filter(status__in=('VALIDATED', 'COMMUNICATED')).count()

    hours = []
    for row in recent.filter(validation_date__isnull=False).only('created_at', 'validation_date'):
        if row.created_at and row.validation_date:
            hours.append((row.validation_date - row.created_at).total_seconds() / 3600.0)
    avg_hours = round(sum(hours) / len(hours), 1) if hours else None

    by_exam = list(
        recent.values('test_name')
        .annotate(count=Count('id'))
        .order_by('-count')[:15]
    )

    by_status = {
        row['status']: row['count']
        for row in qs.values('status').annotate(count=Count('id'))
    }

    return {
        'period_days': days,
        'pending': pending,
        'validated_period': validated,
        'avg_hours_to_validate': avg_hours,
        'by_status': by_status,
        'by_exam': by_exam,
        'total': qs.count(),
    }


def to_fhir_bundle(lab_result):
    """P3 — représentation FHIR légère (ServiceRequest + DiagnosticReport + Observation)."""
    patient_ref = f'Patient/{lab_result.patient_id}'
    org_ref = f'Organization/{lab_result.hospital_id}'
    sr_id = lab_result.fhir_service_request_id or str(lab_result.id)
    dr_id = lab_result.fhir_diagnostic_report_id or f'dr-{lab_result.id}'

    status_map = {
        'REQUESTED': 'active',
        'SAMPLE_COLLECTED': 'active',
        'IN_ANALYSIS': 'active',
        'RESULT_AVAILABLE': 'active',
        'VALIDATED': 'completed',
        'COMMUNICATED': 'completed',
    }
    code_text = lab_result.test_name
    loinc = ''
    if lab_result.hospital_exam_id and lab_result.hospital_exam:
        loinc = (lab_result.hospital_exam.loinc_code or '').strip()
        code_text = lab_result.hospital_exam.name or code_text

    coding = []
    if loinc:
        coding.append({'system': 'http://loinc.org', 'code': loinc, 'display': code_text})

    service_request = {
        'resourceType': 'ServiceRequest',
        'id': sr_id,
        'status': status_map.get(lab_result.status, 'active'),
        'intent': 'order',
        'code': {'coding': coding, 'text': code_text},
        'subject': {'reference': patient_ref},
        'requester': {
            'display': (
                f'{lab_result.ordered_by.user.first_name} {lab_result.ordered_by.user.last_name}'.strip()
                if lab_result.ordered_by_id and lab_result.ordered_by and lab_result.ordered_by.user_id
                else None
            ),
        },
        'authoredOn': lab_result.created_at.isoformat() if lab_result.created_at else None,
        'performer': [{'reference': org_ref}],
        'note': [{'text': lab_result.result_notes}] if lab_result.result_notes else [],
    }

    observations = []
    params = lab_result.parameters if isinstance(lab_result.parameters, list) else []
    if params:
        for idx, row in enumerate(params):
            if not isinstance(row, dict):
                continue
            observations.append({
                'resourceType': 'Observation',
                'id': f'obs-{lab_result.id}-{idx}',
                'status': 'final' if lab_result.status in ('VALIDATED', 'COMMUNICATED') else 'preliminary',
                'code': {'text': row.get('name') or f'Paramètre {idx + 1}'},
                'subject': {'reference': patient_ref},
                'valueString': str(row.get('value') or ''),
                'interpretation': [{'text': row.get('flag')}] if row.get('flag') else [],
                'referenceRange': [{'text': row.get('reference')}] if row.get('reference') else [],
                'unit': row.get('unit') or '',
            })
    elif lab_result.result_value and lab_result.result_value != 'En attente':
        observations.append({
            'resourceType': 'Observation',
            'id': f'obs-{lab_result.id}-0',
            'status': 'final' if lab_result.status in ('VALIDATED', 'COMMUNICATED') else 'preliminary',
            'code': {'text': code_text},
            'subject': {'reference': patient_ref},
            'valueString': lab_result.result_value,
            'referenceRange': [{'text': lab_result.reference_values}] if lab_result.reference_values else [],
        })

    diagnostic_report = {
        'resourceType': 'DiagnosticReport',
        'id': dr_id,
        'status': 'final' if lab_result.status in ('VALIDATED', 'COMMUNICATED') else 'partial',
        'code': {'coding': coding, 'text': code_text},
        'subject': {'reference': patient_ref},
        'effectiveDateTime': lab_result.test_date.isoformat() if lab_result.test_date else None,
        'issued': (
            lab_result.validation_date.isoformat()
            if lab_result.validation_date
            else (lab_result.updated_at.isoformat() if lab_result.updated_at else None)
        ),
        'result': [{'reference': f"Observation/{o['id']}"} for o in observations],
        'conclusion': lab_result.result_notes or '',
        'basedOn': [{'reference': f'ServiceRequest/{sr_id}'}],
    }

    return {
        'resourceType': 'Bundle',
        'type': 'collection',
        'entry': [
            {'resource': service_request},
            {'resource': diagnostic_report},
            *[{'resource': o} for o in observations],
        ],
    }
