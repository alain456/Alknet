from django.db import migrations


def encrypt_existing(apps, schema_editor):
    Application = apps.get_model('education', 'EnrollmentApplication')
    Payment = apps.get_model('education', 'EducationFeePayment')
    from education.tenant_crypto import encrypt_json, encrypt_text

    text_fields = (
        'student_phone', 'guardian_phone', 'student_address',
        'guardian_name', 'previous_school', 'decision_note',
    )
    for row in Application.objects.iterator():
        for name in text_fields:
            setattr(row, name, encrypt_text(row.business_id, getattr(row, name)))
        row.profile_details = encrypt_json(row.business_id, row.profile_details or {})
        row.save(update_fields=[*text_fields, 'profile_details'])

    for row in Payment.objects.select_related('fee').iterator():
        business_id = row.fee.business_id
        row.payer_phone = encrypt_text(business_id, row.payer_phone)
        row.save(update_fields=['payer_phone'])


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0028_tenant_field_room'),
    ]

    operations = [
        migrations.RunPython(encrypt_existing, migrations.RunPython.noop),
    ]
