from django.db import migrations, models


ACCOUNTANT_MARKERS = ('comptable', 'comptab', 'caissier', 'caisse')
CLINICAL_PERMISSIONS = {
    'can_manage_hospital',
    'can_view_medical_records',
    'can_edit_medical_records',
    'can_manage_lab_results',
}


def hide_accountants(apps, schema_editor):
    BusinessRole = apps.get_model('businesses', 'BusinessRole')
    BusinessEmployee = apps.get_model('businesses', 'BusinessEmployee')
    DoctorProfile = apps.get_model('hospital', 'DoctorProfile')

    accountant_role_ids = []
    comptable_role_ids = []
    for role in BusinessRole.objects.all().iterator():
        name = (role.name or '').lower()
        perms = set(role.permissions or [])
        name_hit = any(marker in name for marker in ACCOUNTANT_MARKERS)
        invoice_only = (
            'can_manage_invoices' in perms
            and not CLINICAL_PERMISSIONS.intersection(perms)
        )
        if not (name_hit or invoice_only or role.system_access_level == 'CASHIER_ACCESS'):
            continue
        accountant_role_ids.append(role.id)
        if 'comptable' in name or 'comptab' in name or invoice_only:
            comptable_role_ids.append(role.id)
        if role.system_access_level == 'STAFF_ACCESS' and (name_hit or invoice_only):
            role.system_access_level = 'CASHIER_ACCESS'
            role.save(update_fields=['system_access_level'])

    if not accountant_role_ids:
        return

    employees = BusinessEmployee.objects.filter(role_id__in=accountant_role_ids, is_active=True)
    user_ids = list(employees.values_list('user_id', flat=True))
    DoctorProfile.objects.filter(user_id__in=user_ids).update(
        staff_category='ACCOUNTANT',
        professional_title='AUTRE',
        is_public_directory=False,
        is_accepting_new_patients=False,
        is_available_for_telemedicine=False,
        is_physical_consultation=False,
    )
    if comptable_role_ids:
        BusinessEmployee.objects.filter(
            role_id__in=comptable_role_ids,
            is_active=True,
        ).update(position='COMPTABLE')


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0032_doctorschedule_schedule_date'),
        ('businesses', '0021_commerce_compliance_docs'),
    ]

    operations = [
        migrations.AlterField(
            model_name='doctorprofile',
            name='staff_category',
            field=models.CharField(
                choices=[
                    ('SPECIALIST', 'Médecin Spécialiste'),
                    ('DOCTOR', 'Docteur / Généraliste'),
                    ('NURSE', 'Infirmier(e) / Soignant(e)'),
                    ('RECEPTIONIST', "Agent d'accueil"),
                    ('ACCOUNTANT', 'Comptable'),
                ],
                default='DOCTOR',
                help_text='Catégorie du personnel : médecin, infirmier, accueil ou comptable',
                max_length=20,
            ),
        ),
        migrations.RunPython(hide_accountants, migrations.RunPython.noop),
    ]
