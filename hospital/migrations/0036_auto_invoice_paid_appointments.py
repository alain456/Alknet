"""Facturation automatique des consultations + rattrapage de l'existant.

Avant cette migration, une facture d'hôpital n'était créée que si un agent
cliquait manuellement sur « facturer depuis le rendez-vous ». Résultat : des
rendez-vous réellement payés qui ne produisaient aucune recette comptabilisée.
Une catégorie très utilisée mais invisible dans le chiffre d'affaires.

Cette migration :
  1. rattrape les rendez-vous déjà payés ou exonérés et encore sans facture ;
  2. n'invente aucun paiement — un rendez-vous impayé reçoit une facture
     PENDING (créance), jamais une recette.
"""
from decimal import Decimal

from django.db import migrations

# Les seuls moyens de paiement repris par le module de comptabilité.
KNOWN_METHODS = {'CASH', 'BURUNDIPAY', 'FREE', 'OTHER'}


def hospital_code(business_name, profile):
    if profile and profile.acronym:
        return profile.acronym.upper().replace(' ', '')[:10]
    name = (business_name or 'HOP').upper()
    parts = [p for p in name.replace('-', ' ').split() if p]
    if len(parts) >= 2:
        return ''.join(p[:3] for p in parts[:2])[:10]
    return parts[0][:6] if parts else 'HOP'


def number_allocator(Invoice):
    """Réplique allocate_invoice_number() sur les modèles historiques.

    On ne fait pas appel au module vivant : une migration doit rester
    reproductible même si la logique de numérotation change plus tard.

    Les numéros déjà présents en base sont chargés d'emblée. Sans cela
    l'allocateur repartirait de 000001 et buterait sur la contrainte
    d'unicité — ce qui est exactement arrivé au premier essai.
    """
    used = {}

    def allocate(business_name, profile, year):
        prefix = f'FAC-{hospital_code(business_name, profile)}-{year}-'
        if prefix not in used:
            used[prefix] = {
                (n or '') for n in Invoice.objects.filter(
                    invoice_number__startswith=prefix
                ).values_list('invoice_number', flat=True)
            }
        taken = used[prefix]
        seq = len(taken) + 1
        number = f'{prefix}{seq:06d}'
        while number in taken:
            seq += 1
            number = f'{prefix}{seq:06d}'
        taken.add(number)
        return number

    return allocate


def forwards(apps, schema_editor):
    Appointment = apps.get_model('hospital', 'Appointment')
    Invoice = apps.get_model('hospital', 'Invoice')
    HospitalProfile = apps.get_model('hospital', 'HospitalProfile')
    Business = apps.get_model('businesses', 'Business')

    profiles = {
        p.business_id: p
        for p in HospitalProfile.objects.all()
    }
    names = dict(Business.objects.values_list('id', 'name'))
    allocate = number_allocator(Invoice)

    queryset = (
        Appointment.objects
        .filter(consultation_fee_amount__gt=0)
        .exclude(payment_status__in=['UNPAID', 'FAILED', 'AWAITING_PIN'])
        .exclude(status__in=['CANCELLED', 'REJECTED', 'NO_SHOW', 'DRAFT', 'REQUEST_SENT'])
        .order_by('appointment_date')
    )

    created = 0
    for appointment in queryset:
        already = Invoice.objects.filter(appointment_id=appointment.id).exclude(
            status='CANCELLED'
        ).exists()
        if already:
            continue

        paid = appointment.payment_status in ('PAID', 'WAIVED')
        method = (appointment.payment_method or '').upper()
        if appointment.payment_status == 'WAIVED':
            method = 'FREE'
        if paid and method not in KNOWN_METHODS:
            method = 'OTHER' if method else 'CASH'
        if not paid:
            # Une créance n'a pas de moyen de paiement : sinon la caisse
            # compterait un encaissement qui n'a jamais eu lieu.
            method = ''
        status = 'PAID' if paid or method == 'FREE' else 'PENDING'

        Invoice.objects.create(
            hospital_id=appointment.hospital_id,
            patient_id=appointment.patient_id,
            appointment_id=appointment.id,
            recorded_by_id=appointment.hospital.owner_id,
            invoice_number=allocate(
                names.get(appointment.hospital_id),
                profiles.get(appointment.hospital_id),
                (appointment.paid_at or appointment.appointment_date).year,
            ),
            amount=Decimal(int(appointment.consultation_fee_amount or 0)),
            currency=appointment.consultation_fee_currency or 'BIF',
            description='Consultation',
            act_type='CONSULTATION',
            act_label='Consultation',
            status=status,
            payment_method=method if status == 'PAID' else '',
            paid_at=(appointment.paid_at or appointment.appointment_date) if status == 'PAID' else None,
        )
        created += 1

    if created:
        print(f'  facturation hopital : {created} facture(s) rattrapee(s)')


def backwards(apps, schema_editor):
    """
    Rien à défaire.

    Les factures créées ici sont des pièces comptables réelles : les supprimer
    ferait disparaître de l'historique un acte qui a eu lieu. Seules les
    factures sans numéro — celles produites par la facturation automatique —
    peuvent être identifiées, et les supprimer n'apporte rien. Migration
    volontairement irréversible.
    """


class Migration(migrations.Migration):
    dependencies = [
        ('hospital', '0035_lab_p0_p3'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
