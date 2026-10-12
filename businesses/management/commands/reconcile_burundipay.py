"""Aligne les paiements encore « en attente PIN » avec le statut prestataire."""
from django.core.management.base import BaseCommand

from businesses import burundipay
from businesses.models import BurundiPayReceipt, SubscriptionPayment


class Command(BaseCommand):
    help = 'Interroge BurundiPay et corrige les paiements dont le statut local a divergé.'

    def handle(self, *args, **options):
        checked = 0
        updated = 0
        for payment in SubscriptionPayment.objects.filter(status='AWAITING_PIN').iterator():
            checked += 1
            status = burundipay.check_collection_status(
                provider_reference=payment.provider_reference or '',
                external_id=str(payment.id),
            )
            mapped = (status.get('status') or '').upper()
            if mapped in ('PAID', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED') and payment.provider_reference:
                prior = BurundiPayReceipt.objects.filter(provider_reference=payment.provider_reference).first()
                if prior and prior.external_id != str(payment.id):
                    continue
                from businesses.subscription import activate_subscription_from_payment
                activate_subscription_from_payment(payment)
                BurundiPayReceipt.objects.get_or_create(
                    provider_reference=payment.provider_reference,
                    defaults={'external_id': str(payment.id), 'status': 'SUCCESS'},
                )
                updated += 1
            elif mapped in ('FAILED', 'CANCELLED', 'EXPIRED'):
                payment.status = 'FAILED'
                payment.error_message = status.get('message') or mapped
                payment.save(update_fields=['status', 'error_message', 'updated_at'])
                updated += 1
        self.stdout.write(f'Réconciliation BurundiPay : {checked} en attente, {updated} corrigés.')
