from rest_framework.permissions import BasePermission
from businesses.models import BusinessEmployee
from django.db.models import Q

class IsHospitalAdmin(BasePermission):
    """
    Seuls les propriétaires de l'hôpital ou les employés avec position 'ADMIN'
    ont l'autorisation.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'SUPER_ADMIN':
            return True
        return True

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True
        # Si obj est le Business, ou un enfant (obj.hospital)
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        if getattr(business, 'owner', None) == request.user:
            return True
        return BusinessEmployee.objects.filter(
            Q(position='ADMIN') | Q(role__system_access_level='ADMIN_ACCESS') | Q(role__permissions__contains='can_manage_hospital'),
            business=business, user=request.user, is_active=True
        ).exists()

class IsMedicalStaff(BasePermission):
    """
    Seuls les médecins (locaux ou distants) de cet hôpital ont accès.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        return BusinessEmployee.objects.filter(
            Q(position__in=['LOCAL_DOCTOR', 'REMOTE_SPECIALIST']) | Q(role__system_access_level='MEDICAL_ACCESS') | Q(role__permissions__contains='can_view_medical_records'),
            business=business, user=request.user, is_active=True
        ).exists()

class IsLabTechnician(BasePermission):
    """
    Seuls les laborantins de cet hôpital ont accès.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        return BusinessEmployee.objects.filter(
            Q(position='LAB_TECHNICIAN') | Q(role__system_access_level='LAB_ACCESS') | Q(role__permissions__contains='can_manage_lab_results'),
            business=business, user=request.user, is_active=True
        ).exists()

class IsCashier(BasePermission):
    """
    Seuls les caissiers ou l'admin de l'hôpital ont accès à la facturation.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        if getattr(business, 'owner', None) == request.user:
            return True
        return BusinessEmployee.objects.filter(
            Q(position__in=['CASHIER', 'ADMIN']) | Q(role__system_access_level__in=['CASHIER_ACCESS', 'ADMIN_ACCESS']) | Q(role__permissions__contains='can_manage_invoices') | Q(role__permissions__contains='can_manage_hospital'),
            business=business, user=request.user, is_active=True
        ).exists()

class IsPatientOwner(BasePermission):
    """
    Autorise le patient lui-même à voir ses propres données.
    """
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'patient'):
            return obj.patient == request.user
        return False

class IsMedicalRecordViewer(BasePermission):
    """
    Secret Médical (Data Isolation):
    Le Dossier médical ne doit pas être vu par le Cashier ou le Lab Tech ou l'Admin Business de base.
    Seul Patient, Médecin de l'hôpital et Super Admin le peuvent.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN':
            return True
        if hasattr(obj, 'patient') and obj.patient == request.user:
            return True
        
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        return BusinessEmployee.objects.filter(
            Q(position__in=['LOCAL_DOCTOR', 'REMOTE_SPECIALIST']) | Q(role__system_access_level='MEDICAL_ACCESS') | Q(role__permissions__contains='can_view_medical_records') | Q(role__permissions__contains='can_access_remote_teleconsultation'),
            business=business, user=request.user, is_active=True
        ).exists()

class IsLabResultViewer(BasePermission):
    """
    Permission pour voir les résultats de laboratoire avec sécurité élevée.
    - Les patients ne peuvent voir que les résultats VALIDÉS ou COMMUNIQUÉS
    - Le personnel lab peut voir tous les résultats de leur hôpital
    - Les médecins prescripteurs peuvent voir les résultats qu'ils ont prescrits
    - SUPER_ADMIN voit tout
    """
    def has_object_permission(self, request, view, obj):
        # SUPER_ADMIN voit tout
        if request.user.role == 'SUPER_ADMIN':
            return True
        
        # Le patient ne voit que les résultats validés ou communiqués
        if hasattr(obj, 'patient') and obj.patient == request.user:
            return obj.status in ['VALIDATED', 'COMMUNICATED']
        
        # Personnel lab voit tout de leur hôpital
        business = getattr(obj, 'hospital', obj) if hasattr(obj, 'hospital') else obj
        lab_access = BusinessEmployee.objects.filter(
            Q(position='LAB_TECHNICIAN') | Q(role__system_access_level='LAB_ACCESS') | Q(role__permissions__contains='can_manage_lab_results'),
            business=business, user=request.user, is_active=True
        ).exists()
        
        if lab_access:
            return True
        
        # Médecin prescripteur voit les résultats qu'il a prescrits
        if hasattr(request.user, 'doctor_profile') and hasattr(obj, 'ordered_by'):
            return obj.ordered_by == request.user.doctor_profile
        
        # Médecins de l'hôpital peuvent voir les résultats validés
        if hasattr(request.user, 'doctor_profile') and obj.status in ['VALIDATED', 'COMMUNICATED']:
            medical_access = BusinessEmployee.objects.filter(
                Q(position__in=['LOCAL_DOCTOR', 'REMOTE_SPECIALIST']) | Q(role__system_access_level='MEDICAL_ACCESS'),
                business=business, user=request.user, is_active=True
            ).exists()
            return medical_access
        
        return False
