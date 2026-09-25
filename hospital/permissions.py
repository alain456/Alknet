from rest_framework.permissions import BasePermission, SAFE_METHODS
from businesses.models import BusinessEmployee
from businesses.tenant import get_user_tenant_business
from django.db.models import Q


class IsHospitalAdmin(BasePermission):
    """
    Administration hospitalière — propriétaire ou employé admin de l'établissement.
    Super Admin plateforme exclu.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'SUPER_ADMIN':
            return False
        if request.user.role == 'BUSINESS_OWNER':
            return get_user_tenant_business(request.user) is not None
        return BusinessEmployee.objects.filter(
            Q(position='ADMIN')
            | Q(role__system_access_level='ADMIN_ACCESS')
            | Q(role__permissions__contains='can_manage_hospital'),
            user=request.user,
            is_active=True,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return False
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        if getattr(business, 'owner', None) == request.user:
            return True
        return BusinessEmployee.objects.filter(
            Q(position='ADMIN')
            | Q(role__system_access_level='ADMIN_ACCESS')
            | Q(role__permissions__contains='can_manage_hospital'),
            business=business,
            user=request.user,
            is_active=True,
        ).exists()


class IsMedicalStaff(BasePermission):
    """Médecins de l'hôpital uniquement."""
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return False
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        return BusinessEmployee.objects.filter(
            Q(position__in=['LOCAL_DOCTOR', 'REMOTE_SPECIALIST'])
            | Q(role__system_access_level='MEDICAL_ACCESS')
            | Q(role__permissions__contains='can_view_medical_records'),
            business=business,
            user=request.user,
            is_active=True,
        ).exists()


def _active_employees(user, hospital):
    return list(
        BusinessEmployee.objects.filter(
            business=hospital, user=user, is_active=True,
        ).select_related('role')
    )


def _employee_grants(emps, *codes):
    from .permission_catalog import expand_hospital_permissions
    for emp in emps:
        role = emp.role
        if not role:
            continue
        expanded = expand_hospital_permissions(role.permissions or [])
        if any(code in expanded for code in codes):
            return True
    return False


def user_is_lab_technician(user, hospital):
    """Laborantin opérationnel — crée et fait avancer les résultats jusqu'à notification patient."""
    if not user or not getattr(user, 'is_authenticated', False) or not hospital:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN':
        return False
    # L'admin / propriétaire n'est PAS laborantin (lecture seule côté admin).
    if getattr(hospital, 'owner_id', None) == user.id:
        return False
    emps = _active_employees(user, hospital)
    for emp in emps:
        if emp.position == 'LAB_TECHNICIAN':
            return True
        if emp.role and emp.role.system_access_level == 'LAB_ACCESS':
            return True
    return _employee_grants(emps, 'can_manage_lab_results', 'hospital.lab.create', 'hospital.lab.update')


def user_can_validate_lab_results(user, hospital):
    """P1 — validation clinique : médecin / admin / droit hospital.lab.validate."""
    if not user or not getattr(user, 'is_authenticated', False) or not hospital:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN':
        return False
    if getattr(hospital, 'owner_id', None) == user.id:
        return True
    doctor = getattr(user, 'doctor_profile', None)
    if doctor and doctor.hospital_id == hospital.id:
        return True
    emps = _active_employees(user, hospital)
    for emp in emps:
        if emp.position in ('ADMIN', 'LOCAL_DOCTOR', 'REMOTE_SPECIALIST'):
            return True
        if emp.role and emp.role.system_access_level in ('ADMIN_ACCESS', 'MEDICAL_ACCESS'):
            return True
    return _employee_grants(
        emps,
        'hospital.lab.validate',
        'can_manage_hospital',
        'hospital.manage',
    )


def user_can_view_lab_results(user, hospital):
    """Lecture : laborantin, admin hôpital, médecin, ou propriétaire."""
    if not user or not getattr(user, 'is_authenticated', False) or not hospital:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN':
        return False
    if getattr(hospital, 'owner_id', None) == user.id:
        return True
    if user_is_lab_technician(user, hospital):
        return True
    if user_can_validate_lab_results(user, hospital):
        return True
    emps = _active_employees(user, hospital)
    for emp in emps:
        if emp.position in ('ADMIN', 'LOCAL_DOCTOR', 'REMOTE_SPECIALIST', 'LAB_TECHNICIAN'):
            return True
        if emp.role and emp.role.system_access_level in ('ADMIN_ACCESS', 'MEDICAL_ACCESS', 'LAB_ACCESS'):
            return True
    return _employee_grants(
        emps,
        'can_manage_hospital',
        'can_view_medical_records',
        'can_manage_lab_results',
        'hospital.lab.view',
    )


class IsLabTechnician(BasePermission):
    """
    Laboratoire :
    - Lecture : admin / médecin / laborantin (tenant)
    - Écriture technique : laborantin
    - Validation (update_status VALIDATED) : médecin / validateur aussi autorisé au niveau permission
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == 'SUPER_ADMIN':
            return False
        if user.role == 'CUSTOMER':
            return request.method in SAFE_METHODS

        hospital = get_user_tenant_business(user)
        if not hospital:
            return False

        if request.method in SAFE_METHODS:
            return user_can_view_lab_results(user, hospital)

        action = getattr(view, 'action', None)
        if action in ('update_status', 'upload_document') and user_can_validate_lab_results(user, hospital):
            return True
        return user_is_lab_technician(user, hospital)

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return False
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj

        if hasattr(obj, 'patient') and obj.patient_id == request.user.id:
            if request.method in SAFE_METHODS:
                return getattr(obj, 'status', None) == 'COMMUNICATED'
            return False

        if request.method in SAFE_METHODS:
            return user_can_view_lab_results(request.user, business)

        action = getattr(view, 'action', None)
        if action in ('update_status', 'upload_document') and user_can_validate_lab_results(request.user, business):
            return True
        return user_is_lab_technician(request.user, business)


def user_can_manage_billing(user, hospital):
    """Comptable, caissier ou admin de l'hôpital — factures et clôture."""
    if not user or not getattr(user, 'is_authenticated', False) or not hospital:
        return False
    if getattr(user, 'role', None) == 'SUPER_ADMIN':
        return False
    if getattr(hospital, 'owner_id', None) == user.id:
        return True
    employees = BusinessEmployee.objects.filter(
        business=hospital,
        user=user,
        is_active=True,
    ).select_related('role')
    for emp in employees:
        if emp.position in ('CASHIER', 'ADMIN', 'COMPTABLE'):
            return True
        role = emp.role
        if role is None:
            continue
        if role.system_access_level in ('CASHIER_ACCESS', 'ADMIN_ACCESS'):
            return True
        name = (role.name or '').lower()
        if 'comptab' in name or 'caiss' in name:
            return True
        perms = set(role.permissions or [])
        if 'can_manage_invoices' in perms or 'can_manage_hospital' in perms:
            return True
        from hospital.permission_catalog import grants
        if grants(perms, 'hospital.billing.view', 'hospital.billing.create', 'hospital.manage'):
            return True
    return False


class IsCashier(BasePermission):
    """Caissiers, comptables ou admin de l'hôpital — facturation."""
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == 'CUSTOMER':
            return request.method in SAFE_METHODS
        if user.role == 'SUPER_ADMIN':
            return False
        hospital = get_user_tenant_business(user)
        if not hospital:
            return False
        if request.method in SAFE_METHODS and user.role == 'BUSINESS_OWNER':
            return True
        return user_can_manage_billing(user, hospital) or user.role == 'BUSINESS_OWNER'

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return False
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        if getattr(business, 'owner', None) == request.user:
            return True
        return BusinessEmployee.objects.filter(
            Q(position__in=['CASHIER', 'ADMIN'])
            | Q(role__system_access_level__in=['CASHIER_ACCESS', 'ADMIN_ACCESS'])
            | Q(role__permissions__contains='can_manage_invoices')
            | Q(role__permissions__contains='can_manage_hospital'),
            business=business,
            user=request.user,
            is_active=True,
        ).exists()


class IsReceptionist(BasePermission):
    """Agent d'accueil — gestion opérationnelle des rendez-vous sans accès clinique complet."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'SUPER_ADMIN':
            return False
        business = get_user_tenant_business(request.user)
        if not business:
            return False
        if business.owner_id == request.user.id:
            return True
        from hospital.appointment_workflow import user_is_receptionist, user_can_manage_hospital_appointments
        return user_is_receptionist(request.user, business) or user_can_manage_hospital_appointments(request.user, business)


class IsPatientOwner(BasePermission):
    """Le patient voit ses propres données."""
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'patient'):
            return obj.patient == request.user
        return False


class IsMedicalRecordViewer(BasePermission):
    """
    Secret médical : patient, médecin de l'hôpital uniquement.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return False
        if hasattr(obj, 'patient') and obj.patient == request.user:
            return True

        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        return BusinessEmployee.objects.filter(
            Q(position__in=['LOCAL_DOCTOR', 'REMOTE_SPECIALIST'])
            | Q(role__system_access_level='MEDICAL_ACCESS')
            | Q(role__permissions__contains='can_view_medical_records')
            | Q(role__permissions__contains='can_access_remote_teleconsultation'),
            business=business,
            user=request.user,
            is_active=True,
        ).exists()


class IsLabResultViewer(BasePermission):
    """
    Résultats labo :
    - Patients : résultats VALIDATED ou COMMUNICATED
    - Personnel lab : tous les résultats de leur hôpital
    - Médecins prescripteurs : leurs prescriptions
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return False

        if hasattr(obj, 'patient') and obj.patient == request.user:
            return obj.status in ['VALIDATED', 'COMMUNICATED']

        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        lab_access = BusinessEmployee.objects.filter(
            Q(position='LAB_TECHNICIAN')
            | Q(role__system_access_level='LAB_ACCESS')
            | Q(role__permissions__contains='can_manage_lab_results'),
            business=business,
            user=request.user,
            is_active=True,
        ).exists()

        if lab_access:
            return True

        if hasattr(request.user, 'doctor_profile') and hasattr(obj, 'ordered_by'):
            return obj.ordered_by == request.user.doctor_profile

        if hasattr(request.user, 'doctor_profile') and obj.status in ['VALIDATED', 'COMMUNICATED']:
            medical_access = BusinessEmployee.objects.filter(
                Q(position__in=['LOCAL_DOCTOR', 'REMOTE_SPECIALIST'])
                | Q(role__system_access_level='MEDICAL_ACCESS'),
                business=business,
                user=request.user,
                is_active=True,
            ).exists()
            return medical_access

        return False
