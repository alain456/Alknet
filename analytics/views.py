from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Business
from permissions.custom_permissions import PlatformMethodPermission
from services.models import Service

User = get_user_model()


def _relative_time(dt):
    if not dt:
        return '—'
    delta = timezone.now() - dt
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return 'à l’instant'
    if seconds < 3600:
        m = seconds // 60
        return f'il y a {m} min'
    if seconds < 86400:
        h = seconds // 3600
        return f'il y a {h} h'
    d = seconds // 86400
    if d == 1:
        return 'hier'
    if d < 7:
        return f'il y a {d} j'
    return dt.strftime('%d/%m/%Y')


def _audit_status(status):
    mapping = {
        'SUCCESS': 'success',
        'FAILED': 'error',
        'WARNING': 'warning',
    }
    return mapping.get(status, 'info')


class AdminDashboardStatsView(APIView):
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.analytics.view'}

    def get(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        users_qs = User.objects.all()
        businesses_qs = Business.objects.all()

        total_users = users_qs.count()
        total_active_users = users_qs.filter(is_active=True).count()
        users_this_month = users_qs.filter(created_at__gte=month_start).count()
        users_prev_period = users_qs.filter(
            created_at__gte=month_ago - timedelta(days=30),
            created_at__lt=month_ago,
        ).count()
        users_recent = users_qs.filter(created_at__gte=month_ago).count()

        registered_businesses = businesses_qs.count()
        active_businesses = businesses_qs.filter(
            is_active=True, is_verified=True, verification_status='APPROVED'
        ).count()
        pending_businesses = businesses_qs.filter(verification_status='PENDING').count()
        businesses_this_month = businesses_qs.filter(created_at__gte=month_start).count()
        businesses_prev = businesses_qs.filter(
            created_at__gte=month_ago - timedelta(days=30),
            created_at__lt=month_ago,
        ).count()

        services_active = Service.objects.filter(status='ACTIVE').count()
        services_total = Service.objects.count()

        appointments_pending = 0
        appointments_month = 0
        retail_orders_month = 0
        wholesale_orders_month = 0
        try:
            from hospital.models import Appointment
            appointments_pending = Appointment.objects.filter(status='PENDING').count()
            appointments_month = Appointment.objects.filter(created_at__gte=month_start).count()
        except Exception:
            pass
        try:
            from retail.models import RetailOrder
            retail_orders_month = RetailOrder.objects.filter(created_at__gte=month_start).exclude(status='DRAFT').count()
        except Exception:
            pass
        try:
            from wholesale.models import WholesaleOrder
            wholesale_orders_month = WholesaleOrder.objects.filter(created_at__gte=month_start).exclude(status='DRAFT').count()
        except Exception:
            pass

        active_subscriptions = 0
        try:
            from businesses.subscription import subscription_access_q
            from businesses.models import BusinessSubscription
            active_subscriptions = BusinessSubscription.objects.filter(subscription_access_q('')).count()
        except Exception:
            pass

        # Croissance entreprises — 12 derniers mois
        twelve_months_ago = (now.replace(day=1) - timedelta(days=365)).replace(day=1)
        monthly_rows = (
            businesses_qs.filter(created_at__gte=twelve_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        by_month = {row['month'].strftime('%Y-%m'): row['count'] for row in monthly_rows if row['month']}
        growth = []
        cursor = twelve_months_ago
        for _ in range(12):
            key = cursor.strftime('%Y-%m')
            label = cursor.strftime('%b %Y')
            growth.append({'month': key, 'label': label, 'count': by_month.get(key, 0)})
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)

        max_growth = max((g['count'] for g in growth), default=1) or 1

        # Répartition par rôle
        role_counts = list(
            users_qs.values('role').annotate(count=Count('id')).order_by('-count')
        )
        role_labels = {
            'SUPER_ADMIN': 'Super Admin',
            'BUSINESS_OWNER': 'Entreprises',
            'PROFESSIONAL': 'Professionnels',
            'CUSTOMER': 'Clients',
        }
        acquisition = [
            {
                'key': row['role'] or 'OTHER',
                'label': role_labels.get(row['role'], row['role'] or 'Autre'),
                'count': row['count'],
                'percent': round((row['count'] / total_users) * 100) if total_users else 0,
            }
            for row in role_counts
        ]

        # Activité récente (paiements SaaS d'abord, puis AuditLog)
        recent_activity = []
        try:
            from businesses.models import PlatformNotification
            for n in PlatformNotification.objects.filter(
                notification_type='SUBSCRIPTION_PAID'
            ).select_related('business')[:6]:
                recent_activity.append({
                    'id': str(n.id),
                    'action': 'Abonnement payé',
                    'target': n.business.name if n.business_id else (n.details or {}).get('business_name') or '—',
                    'user': (n.details or {}).get('initiated_by_email') or 'entreprise',
                    'time': _relative_time(n.created_at),
                    'status': 'success',
                })
        except Exception:
            pass
        try:
            from accounts.models import AuditLog
            for log in AuditLog.objects.all()[:12]:
                if len(recent_activity) >= 12:
                    break
                recent_activity.append({
                    'id': str(log.id),
                    'action': log.action.replace('_', ' ').title(),
                    'target': log.resource or '—',
                    'user': log.user_email or 'système',
                    'time': _relative_time(log.created_at),
                    'status': _audit_status(log.status),
                })
        except Exception:
            pass

        # Dernières entreprises (remplace abonnements fictifs)
        recent_businesses = []
        for biz in businesses_qs.order_by('-created_at')[:8]:
            recent_businesses.append({
                'id': str(biz.id),
                'name': biz.name,
                'category': biz.primary_category.name if biz.primary_category_id else (biz.category.name if biz.category_id else '—'),
                'status': biz.verification_status,
                'is_active': biz.is_active,
                'created_at': biz.created_at.isoformat() if biz.created_at else None,
                'created_label': _relative_time(biz.created_at),
            })

        def pct_change(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100, 1)

        return Response({
            'metrics': {
                'total_users': total_users,
                'total_active_users': total_active_users,
                'users_this_month': users_this_month,
                'users_trend': pct_change(users_recent, users_prev_period),
                'registered_businesses': registered_businesses,
                'active_businesses': active_businesses,
                'pending_businesses': pending_businesses,
                'businesses_this_month': businesses_this_month,
                'businesses_trend': pct_change(businesses_this_month, businesses_prev),
                'services_active': services_active,
                'services_total': services_total,
                'appointments_pending': appointments_pending,
                'appointments_month': appointments_month,
                'retail_orders_month': retail_orders_month,
                'wholesale_orders_month': wholesale_orders_month,
                'activity_week': 0,
                'active_subscriptions': active_subscriptions,
            },
            'growth_businesses': growth,
            'growth_max': max_growth,
            'acquisition': acquisition,
            'recent_activity': recent_activity,
            'recent_businesses': recent_businesses,
            'generated_at': now.isoformat(),
        })


class DataGovernanceView(APIView):
    """
    Visibilité portefeuille SaaS + checklist sécurité + état des sauvegardes.
    Réservé Super Admin (responsabilité partagée côté opérateur plateforme).
    """
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.settings.view'}

    PORTFOLIO = [
        ('accounts', 'Comptes & audit', ['CustomUser', 'AuditLog']),
        ('businesses', 'Tenants / entreprises', ['Business', 'BusinessEmployee', 'BusinessRole']),
        ('hospital', 'Module hôpital', ['Appointment', 'DoctorProfile', 'MedicalRecord']),
        ('wholesale', 'Pharmacie de gros', ['WholesaleOrder', 'WholesaleProduct']),
        ('retail', 'Pharmacie de détail', ['RetailOrder', 'RetailProduct', 'Prescription']),
        ('services', 'Services marketplace', ['Service']),
        ('site_content', 'CMS & paramètres', ['SiteSettings', 'ContentPage', 'ContactMessage']),
    ]

    def get(self, request):
        from django.apps import apps
        from django.conf import settings
        from pathlib import Path
        import json

        portfolio = []
        for app_label, title, model_names in self.PORTFOLIO:
            models_info = []
            app_total = 0
            try:
                cfg = apps.get_app_config(app_label)
            except LookupError:
                portfolio.append({
                    'app': app_label, 'title': title, 'status': 'absent',
                    'records': 0, 'models': [],
                })
                continue
            for name in model_names:
                try:
                    model = cfg.get_model(name)
                    count = model.objects.count()
                    app_total += count
                    models_info.append({'model': name, 'records': count})
                except LookupError:
                    models_info.append({'model': name, 'records': None, 'missing': True})
            portfolio.append({
                'app': app_label,
                'title': title,
                'status': 'active',
                'records': app_total,
                'models': models_info,
            })

        debug = bool(settings.DEBUG)
        secure_ssl = bool(getattr(settings, 'SECURE_SSL_REDIRECT', False))
        throttles = bool(settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_CLASSES'))
        cors_open = bool(getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False))

        backup_root = Path(getattr(settings, 'BACKUP_ROOT', settings.BASE_DIR / 'backups'))
        latest = None
        latest_path = backup_root / 'latest.json'
        if latest_path.exists():
            try:
                latest = json.loads(latest_path.read_text(encoding='utf-8'))
            except Exception:
                latest = None

        from accounts.password_validation import get_password_min_length

        return Response({
            'shared_responsibility': {
                'provider': [
                    'Infrastructure serveur / réseau / disponibilité',
                    'Chiffrement disque volume PostgreSQL (hébergeur)',
                    'Mises à jour OS & runtime',
                ],
                'operator': [
                    'Gestion des accès Super Admin / tenants (RBAC)',
                    'Classification des données (santé, commandes, PII)',
                    'Sauvegardes applicatives et tests de restauration',
                    'Revue des journaux d’audit et modération',
                    'Configuration CORS, HTTPS et secrets (.env)',
                ],
            },
            'security_checklist': {
                'debug_disabled': not debug,
                'https_headers': secure_ssl,
                'api_throttling': throttles,
                'cors_restricted': not cors_open or debug,
                'jwt_auth': True,
                'password_min_length': get_password_min_length(),
                'tenant_isolation': True,
                'audit_logs': True,
            },
            'portfolio': portfolio,
            'backups': {
                'root': str(backup_root),
                'retention_days': int(getattr(settings, 'BACKUP_RETENTION_DAYS', 14)),
                'latest': latest,
                'command': 'python manage.py backup_saas_data',
                'postgres_hint': 'docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backups/pg_$(date +%F).sql.gz',
            },
            'generated_at': timezone.now().isoformat(),
        })

    def post(self, request):
        """Déclenche une sauvegarde applicative immédiate."""
        from django.core.management import call_command
        from io import StringIO
        from accounts.services import log_audit_event

        buf = StringIO()
        try:
            call_command('backup_saas_data', stdout=buf)
        except Exception as exc:
            return Response({'error': str(exc)}, status=500)

        log_audit_event(
            user=request.user,
            user_email=request.user.email,
            user_role=request.user.role,
            action='SAAS_BACKUP_TRIGGERED',
            resource='backup_saas_data',
            request=request,
            status='SUCCESS',
            details={'output': buf.getvalue()[-500:]},
        )

        # Relire latest
        get_response = self.get(request)
        data = get_response.data
        data['backup_output'] = buf.getvalue()[-800:]
        return Response(data)
