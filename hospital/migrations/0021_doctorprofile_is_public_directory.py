# Generated for public directory visibility

from django.db import migrations, models


def hide_receptionists_from_directory(apps, schema_editor):
    DoctorProfile = apps.get_model('hospital', 'DoctorProfile')
    BusinessEmployee = apps.get_model('businesses', 'BusinessEmployee')
    receptionist_user_ids = BusinessEmployee.objects.filter(
        role__system_access_level='RECEPTIONIST_ACCESS',
        is_active=True,
    ).values_list('user_id', flat=True)
    DoctorProfile.objects.filter(user_id__in=receptionist_user_ids).update(
        is_public_directory=False,
        staff_category='RECEPTIONIST',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0020_hospital_reference_prefix'),
        ('businesses', '0013_businessrole_permissions'),
    ]

    operations = [
        migrations.AddField(
            model_name='doctorprofile',
            name='is_public_directory',
            field=models.BooleanField(
                default=True,
                help_text="Si False, le profil n'apparaît pas dans l'annuaire client (ex: agent d'accueil)",
            ),
        ),
        migrations.RunPython(hide_receptionists_from_directory, migrations.RunPython.noop),
    ]
