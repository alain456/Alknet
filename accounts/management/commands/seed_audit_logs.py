import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from accounts.models import CustomUser, AuditLog

class Command(BaseCommand):
    help = "Seed initial audit logs for Super Admin traceability dashboard"

    def handle(self, *args, **options):
        self.stdout.write("Seeding audit logs...")
        
        users = list(CustomUser.objects.all())
        if not users:
            self.stdout.write(self.style.WARNING("No users found to attach to audit logs."))

        sample_logs = [
            {
                'action': 'LOGIN_SUCCESS',
                'resource': 'Auth Service (/api/v1/accounts/login/)',
                'status': 'SUCCESS',
                'details': {'method': 'JWT Password Auth', 'browser': 'Chrome 128.0'}
            },
            {
                'action': 'LOGIN_FAILED',
                'resource': 'Auth Service (/api/v1/accounts/login/)',
                'status': 'FAILED',
                'details': {'reason': 'Invalid credentials provided', 'attempts': 3}
            },
            {
                'action': 'USER_CREATED_BY_ADMIN',
                'resource': 'Gestion Utilisateurs - Création Compte',
                'status': 'SUCCESS',
                'details': {'role': 'PROFESSIONAL', 'assigned_business': 'Hôpital Baho'}
            },
            {
                'action': 'ROLE_UPDATED',
                'resource': 'Modification de Rôle Utilisateur',
                'status': 'SUCCESS',
                'details': {'previous_role': 'CUSTOMER', 'new_role': 'BUSINESS_OWNER'}
            },
            {
                'action': 'BUSINESS_APPROVED',
                'resource': 'Approbation Établissement (Kigali Health Clinic)',
                'status': 'SUCCESS',
                'details': {'verification_status': 'VERIFIED', 'approved_by': 'Super Admin'}
            },
            {
                'action': 'EXPORT_DATA_CSV',
                'resource': 'Export Journal d\'Audit & Rapports Financiers',
                'status': 'SUCCESS',
                'details': {'format': 'CSV', 'total_records': 450}
            },
            {
                'action': 'ACCESS_SENSITIVE_DATA',
                'resource': 'Consultation Dossier Médical / Factures',
                'status': 'WARNING',
                'details': {'flag': 'High Frequency Access', 'patient_id': 'PAT-9920'}
            },
            {
                'action': 'PASSWORD_RESET_REQUEST',
                'resource': 'Demande de Réinitialisation Mot de Passe',
                'status': 'SUCCESS',
                'details': {'method': 'Email OTP', 'ip_origin': '197.239.12.8'}
            }
        ]

        sample_ips = [
            '197.239.12.44', '41.204.18.90', '192.168.1.15', 
            '102.130.45.12', '197.239.15.101', '154.120.220.5'
        ]

        now = timezone.now()
        logs_to_create = []

        # Create 25 historical logs spread over the last 7 days
        for i in range(25):
            sample = random.choice(sample_logs)
            user = random.choice(users) if users else None
            email = user.email if user else f"user_{i}@isokohub.com"
            role = user.role if user else "CUSTOMER"

            timestamp = now - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23), minutes=random.randint(0, 59))
            
            logs_to_create.append(AuditLog(
                user=user,
                user_email=email,
                user_role=role,
                action=sample['action'],
                resource=sample['resource'],
                ip_address=random.choice(sample_ips),
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                status=sample['status'],
                details=sample['details'],
                created_at=timestamp
            ))

        AuditLog.objects.bulk_create(logs_to_create)
        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {len(logs_to_create)} audit log entries!"))
