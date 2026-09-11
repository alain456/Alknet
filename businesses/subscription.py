"""
Abonnement SaaS Isoko Hub — règles de blocage des entreprises.

Règles :
- Sans abonnement actif (TRIAL/ACTIVE non expiré) :
  • l'entreprise n'apparaît plus dans les listes publiques
  • l'espace métier est bloqué (écriture / opérations)
- Nouvelle entreprise → plan Free (status TRIAL) pendant duration_days du plan
- Après expiration → paiement Mensuel ou Annuel obligatoire
- Toujours autorisé : consulter son abonnement, profil, paramètres, login
- Les paiements client↔vendeur (commandes) restent privés et séparés
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework.permissions import BasePermission, SAFE_METHODS


ACTIVE_SUBSCRIPTION_STATUSES = ('TRIAL', 'ACTIVE')
DEFAULT_FREE_DAYS = 30
FREE_PLAN_CODE = 'free'
PAID_PLAN_CODES = ('monthly', 'yearly')


def get_or_create_default_plans():
    """Assure Free / Mensuel / Annuel. Retourne le plan Free."""
    from .models import SubscriptionPlan

    free, _ = SubscriptionPlan.objects.get_or_create(
        code=FREE_PLAN_CODE,
        defaults={
            'name': 'Free',
            'description': 'Période gratuite d\'accueil pour découvrir Isoko Hub.',
            'price_bif': 0,
            'duration_days': DEFAULT_FREE_DAYS,
            'is_trial': True,
            'is_active': True,
        },
    )
    # Normaliser si un ancien seed avait un autre libellé
    if free.is_trial is False or free.price_bif != 0:
        free.is_trial = True
        free.price_bif = 0
        free.is_active = True
        free.save(update_fields=['is_trial', 'price_bif', 'is_active'])

    SubscriptionPlan.objects.get_or_create(
        code='monthly',
        defaults={
            'name': 'Mensuel',
            'description': 'Abonnement mensuel standard.',
            'price_bif': 50000,
            'duration_days': 30,
            'is_trial': False,
            'is_active': True,
        },
    )
    SubscriptionPlan.objects.get_or_create(
        code='yearly',
        defaults={
            'name': 'Annuel',
            'description': 'Abonnement annuel.',
            'price_bif': 500000,
            'duration_days': 365,
            'is_trial': False,
            'is_active': True,
        },
    )
    return free


def get_free_plan():
    return get_or_create_default_plans()


def ensure_business_subscription(business, free_days=None):
    """Crée une période Free si l'entreprise n'a pas encore d'abonnement."""
    from .models import BusinessSubscription

    existing = BusinessSubscription.objects.filter(business=business).first()
    if existing:
        return existing

    free_plan = get_free_plan()
    days = free_days if free_days is not None else free_plan.duration_days
    now = timezone.now()
    return BusinessSubscription.objects.create(
        business=business,
        plan=free_plan,
        status='TRIAL',
        starts_at=now,
        ends_at=now + timedelta(days=days),
        notes='Période Free automatique à l\'inscription',
    )


def business_has_active_subscription(business):
    if not business:
        return False
    from django.core.exceptions import ObjectDoesNotExist

    try:
        sub = business.subscription
    except ObjectDoesNotExist:
        return False
    sub.refresh_status(save=True)
    return sub.is_currently_active


def filter_businesses_with_active_subscription(queryset):
    """Filtre un queryset Business aux abonnements TRIAL/ACTIVE non expirés."""
    now = timezone.now()
    return queryset.filter(
        subscription__status__in=ACTIVE_SUBSCRIPTION_STATUSES,
        subscription__ends_at__gte=now,
    )


def subscription_summary(business):
    """Dict léger pour API / frontend."""
    empty = {
        'has_active_subscription': False,
        'status': 'NONE',
        'status_display': 'Aucun abonnement',
        'ends_at': None,
        'plan_code': None,
        'plan_name': None,
        'days_remaining': None,
        'is_blocked': True,
        'payment_reference': '',
        'is_free_period': False,
    }
    if not business:
        return empty
    from django.core.exceptions import ObjectDoesNotExist

    try:
        sub = business.subscription
    except ObjectDoesNotExist:
        return empty

    sub.refresh_status(save=True)
    active = sub.is_currently_active
    days = None
    if sub.ends_at:
        days = max(0, (sub.ends_at.date() - timezone.now().date()).days)

    status_display = sub.get_status_display()
    if sub.status == 'TRIAL':
        status_display = 'Free'

    return {
        'has_active_subscription': active,
        'status': sub.status,
        'status_display': status_display,
        'ends_at': sub.ends_at.isoformat() if sub.ends_at else None,
        'plan_code': sub.plan.code if sub.plan_id else None,
        'plan_name': sub.plan.name if sub.plan_id else None,
        'days_remaining': days,
        'is_blocked': not active,
        'payment_reference': sub.payment_reference or '',
        'is_free_period': sub.status == 'TRIAL',
    }


def list_paid_plans():
    """Plans payants actifs (Mensuel / Annuel)."""
    from .models import SubscriptionPlan

    get_or_create_default_plans()
    return list(
        SubscriptionPlan.objects.filter(is_active=True, is_trial=False)
        .order_by('price_bif')
        .values('id', 'code', 'name', 'description', 'price_bif', 'duration_days')
    )


def list_all_catalog_plans():
    """Catalogue Free + Mensuel + Annuel pour Super Admin."""
    from .models import SubscriptionPlan

    get_or_create_default_plans()
    plans = {
        p.code: p
        for p in SubscriptionPlan.objects.filter(code__in=[FREE_PLAN_CODE, *PAID_PLAN_CODES])
    }
    ordered = []
    for code in (FREE_PLAN_CODE, 'monthly', 'yearly'):
        p = plans.get(code)
        if not p:
            continue
        ordered.append({
            'id': str(p.id),
            'code': p.code,
            'name': p.name,
            'description': p.description or '',
            'price_bif': p.price_bif,
            'duration_days': p.duration_days,
            'is_trial': p.is_trial,
            'is_active': p.is_active,
            'editable_fields': (
                ['duration_days', 'name', 'description']
                if code == FREE_PLAN_CODE
                else ['price_bif', 'name', 'description', 'is_active']
            ),
        })
    return ordered


def update_catalog_plan(code, data):
    """
    Met à jour un plan catalogue.
    Free : duration_days (+ name/description). Prix forcé à 0, toujours actif.
    Mensuel/Annuel : price_bif (+ name/description/is_active). Durées fixes 30/365.
    """
    from .models import SubscriptionPlan

    get_or_create_default_plans()
    plan = SubscriptionPlan.objects.filter(code=code).first()
    if not plan:
        raise ValueError(f'Plan inconnu: {code}')

    if code == FREE_PLAN_CODE:
        if 'duration_days' in data and data['duration_days'] is not None:
            days = int(data['duration_days'])
            if days < 1 or days > 3650:
                raise ValueError('duration_days doit être entre 1 et 3650')
            plan.duration_days = days
        if 'name' in data and data['name'] is not None:
            plan.name = str(data['name']).strip() or plan.name
        if 'description' in data and data['description'] is not None:
            plan.description = str(data['description'])
        plan.price_bif = 0
        plan.is_trial = True
        plan.is_active = True
        plan.save()
        return plan

    if code not in PAID_PLAN_CODES:
        raise ValueError(f'Plan non éditable: {code}')

    if 'price_bif' in data and data['price_bif'] is not None:
        price = int(data['price_bif'])
        if price < 1:
            raise ValueError('price_bif doit être ≥ 1 pour un plan payant')
        plan.price_bif = price
    if 'name' in data and data['name'] is not None:
        plan.name = str(data['name']).strip() or plan.name
    if 'description' in data and data['description'] is not None:
        plan.description = str(data['description'])
    if 'is_active' in data and data['is_active'] is not None:
        plan.is_active = bool(data['is_active'])
    # Durées catalogue stables
    plan.duration_days = 30 if code == 'monthly' else 365
    plan.is_trial = False
    plan.save()
    return plan


def payment_detail_dict(payment):
    """Détail complet d'un paiement SaaS pour historique / notification."""
    business = payment.business
    initiated = payment.initiated_by
    return {
        'id': str(payment.id),
        'business_id': str(business.id) if business else None,
        'business_name': business.name if business else None,
        'owner_email': getattr(business.owner, 'email', None) if business else None,
        'plan_code': payment.plan.code if payment.plan_id else None,
        'plan_name': payment.plan.name if payment.plan_id else None,
        'plan_duration_days': payment.plan.duration_days if payment.plan_id else None,
        'amount_bif': payment.amount_bif,
        'currency': payment.currency,
        'payer_phone': payment.payer_phone,
        'status': payment.status,
        'status_display': payment.get_status_display(),
        'provider': payment.provider,
        'provider_reference': payment.provider_reference or '',
        'merchant_account': payment.merchant_account or '',
        'stub_mode': bool((payment.raw_response or {}).get('mode') == 'stub') or (
            str(payment.provider_reference or '').startswith('STUB-')
        ),
        'initiated_by_email': getattr(initiated, 'email', None) if initiated else None,
        'paid_at': payment.paid_at.isoformat() if payment.paid_at else None,
        'created_at': payment.created_at.isoformat() if payment.created_at else None,
        'error_message': payment.error_message or '',
        'subscription_ends_at': (
            payment.subscription.ends_at.isoformat()
            if payment.subscription_id and payment.subscription.ends_at
            else None
        ),
    }


def notify_super_admins_subscription_paid(payment):
    """
    Historique + alerte Super Admin quand une entreprise paie son abo
    (y compris en simulation Lumicash).
    """
    from django.contrib.auth import get_user_model
    from django.core.mail import send_mail
    from django.conf import settings as dj_settings

    from accounts.services import log_audit_event
    from .models import PlatformNotification
    from . import lumicash

    detail = payment_detail_dict(payment)
    business_name = detail.get('business_name') or 'Entreprise'
    amount = detail.get('amount_bif') or 0
    stub = detail.get('stub_mode') or lumicash.is_stub_mode()

    title = f"Abonnement payé — {business_name}"
    message = (
        f"« {business_name} » a payé son abonnement Isoko Hub : "
        f"{amount} {detail.get('currency') or 'BIF'} "
        f"(plan {detail.get('plan_name') or detail.get('plan_code')}, "
        f"Lumicash {detail.get('payer_phone')})"
        f"{' — SIMULATION' if stub else ''}."
    )

    PlatformNotification.objects.create(
        notification_type='SUBSCRIPTION_PAID',
        title=title,
        message=message,
        details=detail,
        business=payment.business,
        payment=payment,
        is_read=False,
    )

    log_audit_event(
        user=payment.initiated_by,
        action='SUBSCRIPTION_PAYMENT_SUCCESS',
        resource=f'business:{payment.business_id}/payment:{payment.id}',
        status='SUCCESS',
        details={
            **detail,
            'notification': title,
            'note': 'Paiement SaaS reçu sur le compte marchand plateforme',
        },
    )

    User = get_user_model()
    admin_emails = list(
        User.objects.filter(role='SUPER_ADMIN', is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )
    if admin_emails:
        body_lines = [
            message,
            '',
            'Détails :',
            f"- Entreprise : {detail.get('business_name')}",
            f"- Propriétaire : {detail.get('owner_email')}",
            f"- Plan : {detail.get('plan_name')} ({detail.get('plan_duration_days')} j)",
            f"- Montant : {detail.get('amount_bif')} {detail.get('currency')}",
            f"- Téléphone Lumicash : {detail.get('payer_phone')}",
            f"- Référence : {detail.get('provider_reference')}",
            f"- Marchand : {detail.get('merchant_account')}",
            f"- Initié par : {detail.get('initiated_by_email')}",
            f"- Payé le : {detail.get('paid_at')}",
            f"- Abo valide jusqu'au : {detail.get('subscription_ends_at')}",
            f"- Mode stub : {'oui' if stub else 'non'}",
            '',
            'Voir /admin/payments pour l’historique complet.',
        ]
        try:
            send_mail(
                subject=f"[Isoko Hub] {title}",
                message='\n'.join(body_lines),
                from_email=getattr(dj_settings, 'DEFAULT_FROM_EMAIL', None),
                recipient_list=admin_emails,
                fail_silently=True,
            )
        except Exception:
            pass


def activate_subscription_from_payment(payment):
    """
    Après succès Lumicash : active / prolonge l'abonnement SaaS.
    L'argent est versé au marchand Isoko Hub (pas au tenant).
    """
    if payment.status == 'SUCCESS' and payment.paid_at:
        return ensure_business_subscription(payment.business)

    now = timezone.now()
    business = payment.business
    plan = payment.plan
    sub = ensure_business_subscription(business)
    sub.refresh_status(save=True)

    if sub.status in ACTIVE_SUBSCRIPTION_STATUSES and sub.ends_at and sub.ends_at > now:
        base = sub.ends_at
    else:
        base = now
        sub.starts_at = now

    sub.plan = plan
    sub.status = 'ACTIVE'
    sub.ends_at = base + timedelta(days=plan.duration_days)
    sub.payment_reference = payment.provider_reference or str(payment.id)
    sub.notes = (
        f'Paiement Lumicash SaaS {payment.amount_bif} BIF '
        f'depuis {payment.payer_phone} → marchand plateforme'
    )
    sub.save()

    payment.status = 'SUCCESS'
    payment.paid_at = now
    payment.subscription = sub
    payment.save(update_fields=['status', 'paid_at', 'subscription', 'updated_at'])

    payment = type(payment).objects.select_related(
        'business', 'business__owner', 'plan', 'subscription', 'initiated_by'
    ).get(pk=payment.pk)
    notify_super_admins_subscription_paid(payment)

    return sub


class RequiresActiveBusinessSubscription(BasePermission):
    """
    Bloque les écritures métier si l'abonnement entreprise est inactif.
    Lecture (SAFE) autorisée pour afficher l'écran de renouvellement.
    """
    message = (
        "Abonnement Isoko Hub inactif ou expiré. "
        "Renouvelez votre abonnement pour continuer à utiliser la plateforme."
    )

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        # Super Admin plateforme n'est pas un tenant
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'role', None) == 'SUPER_ADMIN':
            return True

        from .tenant import get_user_tenant_business
        business = get_user_tenant_business(user)
        if not business:
            return True
        return business_has_active_subscription(business)
