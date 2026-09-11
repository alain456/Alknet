"""
Paiement consultation RDV : patient → compte marchand de l'hôpital (Lumicash).
Tarif = DoctorProfile.consultation_fee figé à la réservation.
Distinct de l'abonnement SaaS (entreprise → Isoko Hub).
"""
from __future__ import annotations

from django.utils import timezone

from businesses import lumicash


def fee_from_doctor(doctor) -> tuple[int, str]:
    if not doctor:
        return 0, 'BIF'
    raw = getattr(doctor, 'consultation_fee', 0) or 0
    try:
        amount = int(round(float(raw)))
    except (TypeError, ValueError):
        amount = 0
    currency = getattr(doctor, 'consultation_fee_currency', None) or 'BIF'
    return max(0, amount), currency


def hospital_merchant_account(hospital) -> str:
    if not hospital:
        return 'HOSPITAL_MERCHANT'
    configured = (getattr(hospital, 'lumicash_merchant_account', None) or '').strip()
    if configured:
        return configured
    # Stub / fallback lisible
    return f'HOSP-{str(hospital.id).replace("-", "")[:10].upper()}'


def apply_fee_snapshot(appointment) -> None:
    """Fige le tarif médecin sur le RDV (appelé à la création)."""
    amount, currency = fee_from_doctor(appointment.doctor)
    appointment.consultation_fee_amount = amount
    appointment.consultation_fee_currency = currency
    if amount <= 0:
        appointment.payment_status = 'PAID'
        appointment.payment_method = 'FREE'
        appointment.paid_at = timezone.now()
        appointment.payment_note = 'Consultation sans frais (tarif médecin = 0)'
    else:
        appointment.payment_status = 'UNPAID'
    appointment.payment_merchant_account = hospital_merchant_account(appointment.hospital)


def appointment_is_payment_settled(appointment) -> bool:
    return appointment.payment_status in ('PAID', 'WAIVED')


def initiate_appointment_payment(appointment, payer_phone: str) -> dict:
    """
    Initie un débit Lumicash vers le marchand de l'hôpital.
    """
    if appointment_is_payment_settled(appointment):
        return {
            'ok': True,
            'already_paid': True,
            'message': 'Consultation déjà payée ou exonérée.',
            'appointment': appointment,
        }

    amount = int(appointment.consultation_fee_amount or 0)
    if amount <= 0:
        appointment.payment_status = 'PAID'
        appointment.payment_method = 'FREE'
        appointment.paid_at = timezone.now()
        appointment.save(update_fields=[
            'payment_status', 'payment_method', 'paid_at', 'updated_at',
        ])
        return {
            'ok': True,
            'already_paid': True,
            'message': 'Aucun montant à payer.',
            'appointment': appointment,
        }

    merchant = hospital_merchant_account(appointment.hospital)
    result = lumicash.initiate_collection(
        amount_bif=amount,
        payer_phone=payer_phone,
        external_id=f'appt-{appointment.id}',
        description=(
            f'Consultation {appointment.reference_code or appointment.id} — '
            f'{appointment.hospital.name}'
        ),
        merchant=merchant,
    )

    appointment.payer_phone = lumicash.normalize_phone(payer_phone)
    appointment.payment_method = 'LUMICASH'
    appointment.payment_merchant_account = merchant
    appointment.payment_provider_reference = result.get('provider_reference') or ''
    if result.get('ok'):
        appointment.payment_status = result.get('status') or 'AWAITING_PIN'
        appointment.payment_note = ''
    else:
        appointment.payment_status = 'FAILED'
        appointment.payment_note = result.get('message') or 'Échec initiation Lumicash'
    appointment.save(update_fields=[
        'payer_phone', 'payment_method', 'payment_merchant_account',
        'payment_provider_reference', 'payment_status', 'payment_note', 'updated_at',
    ])

    return {
        'ok': bool(result.get('ok')),
        'already_paid': False,
        'message': result.get('message') or '',
        'stub_mode': lumicash.is_stub_mode(),
        'provider_reference': appointment.payment_provider_reference,
        'merchant_account': merchant,
        'amount_bif': amount,
        'currency': appointment.consultation_fee_currency or 'BIF',
        'appointment': appointment,
    }


def confirm_appointment_payment_stub(appointment) -> dict:
    """Confirme le paiement en mode simulation Lumicash."""
    if not lumicash.is_stub_mode():
        return {
            'ok': False,
            'message': 'Confirmation manuelle réservée au mode simulation.',
            'appointment': appointment,
        }
    if appointment.payment_status == 'PAID':
        return {'ok': True, 'message': 'Déjà payé.', 'appointment': appointment}
    if appointment.payment_status not in ('AWAITING_PIN', 'UNPAID', 'FAILED'):
        return {
            'ok': False,
            'message': f'Statut paiement incompatible: {appointment.payment_status}',
            'appointment': appointment,
        }

    appointment.payment_status = 'PAID'
    appointment.paid_at = timezone.now()
    appointment.payment_method = appointment.payment_method or 'LUMICASH'
    appointment.payment_note = 'Paiement confirmé (simulation Lumicash)'
    appointment.save(update_fields=[
        'payment_status', 'paid_at', 'payment_method', 'payment_note', 'updated_at',
    ])
    return {
        'ok': True,
        'message': 'Paiement consultation confirmé (simulation).',
        'appointment': appointment,
    }


def mark_appointment_paid_by_staff(appointment, *, method='CASH', note='', actor=None) -> dict:
    """Caisse / admin : marque la consultation comme payée hors ligne."""
    appointment.payment_status = 'PAID'
    appointment.paid_at = timezone.now()
    appointment.payment_method = (method or 'CASH').upper()[:40]
    appointment.payment_note = (note or 'Marqué payé par le personnel').strip()[:255]
    if actor and not appointment.payer_phone:
        pass
    appointment.save(update_fields=[
        'payment_status', 'paid_at', 'payment_method', 'payment_note', 'updated_at',
    ])
    return {'ok': True, 'message': 'Consultation marquée payée.', 'appointment': appointment}


def appointment_has_collectible_payment(appointment) -> bool:
    """True si un paiement patient a été encaissé et peut nécessiter un remboursement."""
    return (
        appointment.payment_status == 'PAID'
        and int(appointment.consultation_fee_amount or 0) > 0
        and (appointment.payment_method or '') != 'FREE'
    )


def refund_appointment_payment(appointment, *, note='', actor=None) -> dict:
    """
    Rembourse la consultation (stub Lumicash / manuel).
    PAID → REFUNDED. Ensuite l'admin peut refuser / annuler le RDV.
    """
    if appointment.payment_status == 'REFUNDED':
        return {
            'ok': True,
            'already_refunded': True,
            'message': 'Consultation déjà remboursée.',
            'appointment': appointment,
        }
    if appointment.payment_status == 'WAIVED':
        return {
            'ok': False,
            'message': 'Consultation exonérée — aucun remboursement.',
            'appointment': appointment,
        }
    if appointment.payment_status != 'PAID':
        return {
            'ok': False,
            'message': (
                f'Impossible de rembourser : statut paiement = {appointment.payment_status}. '
                'Seul un RDV payé peut être remboursé.'
            ),
            'appointment': appointment,
        }
    if int(appointment.consultation_fee_amount or 0) <= 0:
        appointment.payment_status = 'REFUNDED'
        appointment.payment_note = 'Aucun montant à rembourser'
        appointment.save(update_fields=['payment_status', 'payment_note', 'updated_at'])
        return {
            'ok': True,
            'message': 'Aucun montant à rembourser.',
            'appointment': appointment,
        }

    # Stub : en production, appeler l'API remboursment Lumicash vers payer_phone
    actor_label = ''
    if actor is not None:
        actor_label = getattr(actor, 'email', None) or str(actor)
    base_note = (
        f'Remboursement {appointment.consultation_fee_amount} '
        f'{appointment.consultation_fee_currency or "BIF"}'
        f' → {appointment.payer_phone or "patient"}'
        f' (marchand {appointment.payment_merchant_account or "—"})'
    )
    if lumicash.is_stub_mode():
        base_note = f'{base_note} — SIMULATION Lumicash'
    if note:
        base_note = f'{base_note}. {note.strip()}'
    if actor_label:
        base_note = f'{base_note} [{actor_label}]'

    appointment.payment_status = 'REFUNDED'
    appointment.payment_note = base_note[:255]
    appointment.save(update_fields=['payment_status', 'payment_note', 'updated_at'])

    email_result = None
    try:
        from .appointment_workflow import notify_appointment_refunded
        email_result = notify_appointment_refunded(
            appointment, note=note, actor=actor,
        )
    except Exception:
        email_result = {'patient_email_sent': False}

    return {
        'ok': True,
        'already_refunded': False,
        'stub_mode': lumicash.is_stub_mode(),
        'message': (
            'Remboursement enregistré. '
            + (
                'Mode simulation : effectuez le transfert Lumicash réel vers le patient si besoin.'
                if lumicash.is_stub_mode()
                else 'Vérifiez le crédit sur le numéro Lumicash du patient.'
            )
        ),
        'appointment': appointment,
        'amount_bif': appointment.consultation_fee_amount,
        'payer_phone': appointment.payer_phone,
        'email_notification': email_result,
    }
